const express = require("express");
const crypto = require("node:crypto");
const { asyncHandler } = require("../middleware/asyncHandler");
const { createExecutionsQueue } = require("../../shared/queue");
const { prisma } = require("../../shared/prisma");

const router = express.Router();

// Una sola cola compartida por todas las peticiones. Crear y cerrar una
// conexión a Redis por webhook desperdicia recursos y contradice la regla
// de reutilizar los clientes compartidos.
let executionsQueue;
function queue() {
  if (!executionsQueue) executionsQueue = createExecutionsQueue();
  return executionsQueue;
}

// Compara la firma en tiempo constante. Un `===` corriente tarda distinto
// según cuántos caracteres coinciden, lo que filtra información sobre la
// firma esperada.
function verifyGitHubSignature(payload, signature, secret) {
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
  const recibida = Buffer.from(signature);
  const esperada = Buffer.from(expected);
  return recibida.length === esperada.length && crypto.timingSafeEqual(recibida, esperada);
}

// El identificador de la automatización viaja en la URL: cada automatización
// registra su propio webhook en GitHub. Sin esto, un evento de un repositorio
// podría disparar la automatización de otra persona.
router.post(
  "/github/:automationId",
  asyncHandler(async (request, response) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET || "";

    // Sin secreto no hay forma de comprobar que el evento venga de GitHub.
    // Aceptar en ese caso dejaría el endpoint abierto a cualquiera.
    if (!secret) {
      console.error("GITHUB_WEBHOOK_SECRET no está configurado: se rechaza el webhook");
      return response.status(503).json({ error: "WEBHOOK_SECRET_NOT_CONFIGURED" });
    }

    const rawPayload = request.rawBody ? request.rawBody.toString("utf8") : "";
    const signature = request.get("x-hub-signature-256") || "";

    if (!rawPayload || !verifyGitHubSignature(rawPayload, signature, secret)) {
      return response.status(401).json({ error: "WEBHOOK_SIGNATURE_INVALID" });
    }

    // GitHub reintenta una entrega fallida conservando este identificador.
    // Usarlo como eventId es lo que permite que el motor descarte duplicados;
    // con una marca de tiempo, cada reintento se ejecutaría de nuevo.
    const deliveryId = request.get("x-github-delivery");
    if (!deliveryId) {
      return response.status(400).json({ error: "WEBHOOK_DELIVERY_ID_MISSING" });
    }

    const parsedBody = request.body && typeof request.body === "object" ? request.body : {};

    const automation = await prisma.automation.findFirst({
      where: {
        id: request.params.automationId,
        enabled: true,
        triggerType: "GITHUB_WEBHOOK",
      },
    });

    // Se responde 202 aunque no haya automatización activa: el evento se
    // recibió correctamente y GitHub no debe reintentarlo. Un 404 provocaría
    // reintentos inútiles y marcaría el webhook como fallido en el proveedor.
    if (!automation) {
      return response.status(202).json({ accepted: true, reason: "no_automation_registered" });
    }

    // La API solo encola: no ejecuta ninguna acción externa dentro de la
    // petición HTTP. El worker las ejecuta después, de forma asíncrona.
    await queue().add("run-automation", {
      automationId: automation.id,
      eventId: deliveryId,
      triggerData: {
        event: request.get("x-github-event") || "unknown",
        repository: parsedBody?.repository?.full_name || "unknown",
        action: parsedBody?.action || "unknown",
        title: parsedBody?.issue?.title || parsedBody?.pull_request?.title || "",
        sender: parsedBody?.sender?.login || "",
        url: parsedBody?.issue?.html_url || parsedBody?.pull_request?.html_url || "",
        payload: parsedBody,
      },
      version: 1,
    });

    response.status(202).json({ accepted: true, queued: true });
  }),
);

module.exports = { webhooksRouter: router };
