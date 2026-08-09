// Encola un trabajo de prueba sin necesidad de un webhook real.
//
// Uso:
//   npm run enqueue:test-job <automationId> [eventId]
//
// Los datos del disparador imitan los que arma el webhook de GitHub
// (src/api/routes/webhooks.js). Deben coincidir en los nombres de los campos:
// si no, las plantillas {{trigger.title}} que sugiere la interfaz se resuelven
// vacías al probar y parece un error del motor cuando no lo es.
const { validateEnvironment } = require("../src/config");
const { createExecutionsQueue } = require("../src/shared/queue");

const DATOS_DE_PRUEBA = {
  event: "issues",
  action: "opened",
  repository: "flowhub/test-repo",
  title: "Demo desde script",
  sender: "usuario-de-prueba",
  url: "https://github.com/flowhub/test-repo/issues/1",
};

async function main() {
  validateEnvironment();

  const queue = createExecutionsQueue();
  const automationId = process.argv[2];
  const eventId = process.argv[3] || `event-${Date.now()}`;

  if (!automationId) {
    console.error("Falta el identificador de la automatización.");
    console.error("Uso: npm run enqueue:test-job <automationId> [eventId]");
    console.error("El identificador aparece en la URL al editar la automatización.");
    await queue.close();
    // La conexión a Redis se creó fuera de BullMQ, así que close() no la
    // libera y el proceso quedaría esperando para siempre.
    process.exit(1);
  }

  const job = await queue.add("run-automation", {
    automationId,
    eventId,
    triggerData: DATOS_DE_PRUEBA,
    version: 1,
  });

  console.log(`Job encolado: ${job.id}`);
  console.log(`  automatización: ${automationId}`);
  console.log(`  evento: ${eventId}`);
  console.log(`  campos disponibles para plantillas: ${Object.keys(DATOS_DE_PRUEBA).join(", ")}`);
  await queue.close();
  process.exit(0);
}

main().catch((error) => {
  console.error("No se pudo encolar el job", error);
  process.exit(1);
});
