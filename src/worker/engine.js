// Motor de ejecución: evalúa las condiciones y ejecuta la cadena de acciones
// de una automatización. Lo invoca el worker por cada trabajo de la cola.
//
// Pendiente de implementar en las fases 5 a 8 de TAREAS.md:
//   - idempotencia por (automationId, eventId)
//   - evaluación de condiciones
//   - interpolación de plantillas {{trigger.campo}}
//   - despacho a los adaptadores por proveedor
//   - registro del resultado en la bitácora
const { prisma } = require("../shared/prisma");

/**
 * Ejecuta una automatización a partir de un trabajo de la cola.
 * @param {{ automationId: string, eventId: string, triggerData: object }} job
 */
async function runAutomation(job) {
  const { automationId, eventId } = job;

  if (!automationId || !eventId) {
    throw new Error("El trabajo debe incluir automationId y eventId");
  }

  const automation = await prisma.automation.findUnique({ where: { id: automationId } });

  if (!automation || !automation.enabled) {
    return { skipped: true, reason: "automatizacion inexistente o desactivada" };
  }

  throw new Error("El motor de ejecucion aun no esta implementado");
}

module.exports = { runAutomation };
