const { prisma } = require("../shared/prisma");
const { createExecutionsQueue } = require("../shared/queue");

function buildCronJobName(automationId) {
  return `cron:${automationId}`;
}

/**
 * Sincroniza las programaciones de BullMQ con las automatizaciones de tipo CRON.
 *
 * Es una sincronización en los dos sentidos:
 *   - agrega las programaciones que faltan,
 *   - y elimina las que sobran (automatización desactivada, borrada o con la
 *     expresión cron cambiada).
 *
 * Sin la parte de eliminar, una automatización apagada seguiría disparándose.
 */
async function syncCronAutomations(queue = createExecutionsQueue()) {
  const automations = await prisma.automation.findMany({
    where: { enabled: true, triggerType: "CRON" },
  });

  // Los trabajos repetibles no aparecen en getJobs(): tienen su propia API.
  const repetibles = await queue.getRepeatableJobs();
  const existentes = new Map(repetibles.map((job) => [job.name, job]));

  const deseadas = new Map();
  for (const automation of automations) {
    const expression = automation.triggerConfig?.expression;
    // Una automatización sin expresión no puede programarse; se ignora en vez
    // de aplicarle una frecuencia inventada.
    if (!expression) {
      console.warn(`Automatización ${automation.id} es CRON pero no tiene expresión; se omite`);
      continue;
    }
    deseadas.set(buildCronJobName(automation.id), { automation, expression });
  }

  // Alta de las que faltan y de las que cambiaron de expresión.
  for (const [name, { automation, expression }] of deseadas) {
    const actual = existentes.get(name);
    if (actual && actual.pattern === expression) continue;

    // Si cambió la expresión, primero se retira la programación anterior.
    if (actual) await queue.removeRepeatableByKey(actual.key);

    await queue.add(
      name,
      {
        automationId: automation.id,
        // El identificador se completa en cada disparo con la marca de tiempo
        // de la ejecución, para que cada corrida sea un evento distinto.
        eventId: null,
        triggerData: {
          expression,
          automationName: automation.name,
        },
        version: 1,
      },
      { repeat: { pattern: expression } },
    );
  }

  // Baja de las programaciones que ya no corresponden a ninguna automatización
  // activa: desactivadas, eliminadas o que dejaron de ser de tipo CRON.
  for (const [name, job] of existentes) {
    if (deseadas.has(name)) continue;
    if (!name.startsWith("cron:")) continue;
    await queue.removeRepeatableByKey(job.key);
  }
}

module.exports = { syncCronAutomations, buildCronJobName };
