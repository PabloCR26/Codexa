// Motor de ejecución: evalúa las condiciones y ejecuta la cadena de acciones
// de una automatización. Lo invoca el worker por cada trabajo de la cola.
const { prisma: defaultPrisma } = require("../shared/prisma");
const { decryptToken } = require("../shared/tokenCrypto");
const { getValidAccessToken } = require("../shared/oauthTokens");
const { getAdapter } = require("./adapters");
const { pollGmailAutomation } = require("./gmailPoller");

function getValueAtPath(data, path) {
  if (!path) return undefined;
  const segments = String(path).split(".");
  let current = data;

  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    if (!(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function interpolateValue(value, triggerData) {
  if (typeof value === "string") {
    return value.replace(/\{\{\s*([^{}]+)\s*\}\}/g, (_full, path) => {
      const resolved = getValueAtPath(triggerData, path.trim());
      return resolved === undefined || resolved === null ? "" : String(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolateValue(item, triggerData));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, interpolateValue(nested, triggerData)]),
    );
  }

  return value;
}

function evaluateCondition(condition, triggerData) {
  if (!condition || typeof condition !== "object") return true;

  const actualValue = getValueAtPath(triggerData, condition.field);
  const expectedValue = condition.value;

  switch (condition.operator) {
    case "eq":
      return String(actualValue) === String(expectedValue);
    case "neq":
      return String(actualValue) !== String(expectedValue);
    case "contains":
      return String(actualValue).includes(String(expectedValue));
    case "gt":
      return Number(actualValue) > Number(expectedValue);
    case "lt":
      return Number(actualValue) < Number(expectedValue);
    default:
      return true;
  }
}

/**
 * Ejecuta una automatización a partir de un trabajo de la cola.
 * @param {{ automationId: string, eventId: string, triggerData: object }} job
 */
async function runAutomation(job, options = {}) {
  const prismaClient = options.prismaClient || defaultPrisma;
  const adapterContext = options.adapterContext || {};
  const { automationId, eventId, triggerData = {} } = job || {};

  if (!automationId || !eventId) {
    throw new Error("El trabajo debe incluir automationId y eventId");
  }

  const automation = await prismaClient.automation.findUnique({ where: { id: automationId } });

  if (!automation || !automation.enabled) {
    return { skipped: true, reason: "automatizacion inexistente o desactivada" };
  }

  const existingExecution = await prismaClient.execution.findUnique({
    where: {
      automationId_eventId: {
        automationId,
        eventId,
      },
    },
  });

  // Idempotencia: lo que nunca debe repetirse es un trabajo que ya terminó
  // bien. Si el proveedor reenvía la misma entrega y su ejecución quedó
  // SUCCEEDED (o se omitió por condiciones), no se vuelve a ejecutar.
  const TERMINADAS = ["SUCCEEDED", "SKIPPED"];
  if (existingExecution && TERMINADAS.includes(existingExecution.status)) {
    return { skipped: true, reason: "ejecucion ya registrada", execution: existingExecution };
  }

  // Si existe pero no llegó a terminar bien, se reutiliza la misma fila: es un
  // reintento del mismo evento. Crear otra violaría la restricción única
  // (automationId, eventId) y ensuciaría la bitácora con duplicados.
  const execution = existingExecution
    ? await prismaClient.execution.update({
        where: { id: existingExecution.id },
        data: {
          status: "PENDING",
          attempt: (existingExecution.attempt || 0) + 1,
          error: null,
          finishedAt: null,
        },
      })
    : await prismaClient.execution.create({
        data: {
          automationId,
          eventId,
          status: "PENDING",
          userId: automation.userId,
          triggerData,
          attempt: 0,
        },
      });

  const actionResults = [];
  try {
    await prismaClient.execution.update({
      where: { id: execution.id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    if (automation.triggerType === "GMAIL_POLL") {
      const pollResult = await pollGmailAutomation(automation);
      return { status: "SKIPPED", execution: execution, pollResult };
    }

    // Contexto de resolución para condiciones y plantillas.
    //
    // El enunciado y la interfaz usan la forma {{trigger.titulo}}, pero los
    // datos del disparador llegan planos ({ titulo, ... }). Sin el envoltorio
    // "trigger" esas plantillas resolvían siempre a cadena vacía. Se exponen
    // las dos formas para que funcionen {{trigger.titulo}} y {{titulo}}.
    const contexto = { ...triggerData, trigger: triggerData };

    const conditions = Array.isArray(automation.conditions) ? automation.conditions : [];
    const conditionsMet = conditions.every((condition) => evaluateCondition(condition, contexto));

    if (!conditionsMet) {
      const skippedExecution = await prismaClient.execution.update({
        where: { id: execution.id },
        data: {
          status: "SKIPPED",
          finishedAt: new Date(),
          output: { skipped: true, reason: "conditions_not_met" },
        },
      });
      return { status: "SKIPPED", execution: skippedExecution };
    }

    for (const action of Array.isArray(automation.actions) ? automation.actions : []) {
      const resolvedParams = interpolateValue(action.params || {}, contexto);
      const connection = await prismaClient.connection.findFirst({
        where: {
          userId: automation.userId,
          provider: action.provider,
        },
      });

      // Se pide un token vigente en lugar de usar el guardado: los de Google
      // caducan a la hora, y sin renovarlos toda acción de Gmail falla con 401.
      // getValidAccessToken lo renueva y lo guarda cuando hace falta.
      const accessToken = connection?.accessToken
        ? connection.accessToken
        : await getValidAccessToken(connection);

      const adapterConnection = {
        ...connection,
        accessToken,
        refreshToken: connection?.refreshToken || (connection?.refreshTokenEncrypted ? decryptToken(connection.refreshTokenEncrypted) : undefined),
      };

      const adapter = getAdapter(action.provider, action.actionType);
      const result = adapterContext.skipExternalCalls
        ? { success: true, skipped: true, reason: "skip_external_calls" }
        : await adapter({ params: resolvedParams, connection: adapterConnection, context: { automation, execution, triggerData } });

      actionResults.push({
        provider: action.provider,
        actionType: action.actionType,
        params: resolvedParams,
        result,
      });
    }

    const finishedExecution = await prismaClient.execution.update({
      where: { id: execution.id },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        output: { actions: actionResults, triggerData },
      },
    });

    return { status: "SUCCEEDED", execution: finishedExecution, actionResults };
  } catch (error) {
    await prismaClient.execution.update({
      where: { id: execution.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: {
          message: error.message,
          code: error.code || "EXECUTION_FAILED",
          statusCode: error.statusCode || 500,
        },
        output: { actions: actionResults, triggerData },
      },
    });

    // El error se relanza en lugar de devolverse. Si se devolviera un
    // resultado, BullMQ daría el trabajo por exitoso y no habría reintentos
    // ni cola de fallidos: toda la política de robustez quedaría inerte.
    error.executionId = execution.id;
    throw error;
  }
}

// evaluateCondition e interpolateValue se exportan para poder probarlas de
// forma aislada, sin montar una ejecución completa.
module.exports = { runAutomation, evaluateCondition, interpolateValue };
