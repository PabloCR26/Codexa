// Adaptador para Gmail
// Envía correos a través de la API de Gmail

// Clasificación de errores, en números y no con expresiones regulares: la
// versión anterior usaba /^4[0-2]\d/ para "permanente", que también capturaba
// el 429 y hacía que un límite de tasa no se reintentara nunca.
//
//   permanente   -> 4xx menos 429: repetirlo daría el mismo resultado
//   reintentable -> 429 y 5xx: el problema es temporal
function esPermanente(statusCode) {
  return statusCode >= 400 && statusCode < 500 && statusCode !== 429;
}

function esReintentable(statusCode) {
  return statusCode === 429 || statusCode >= 500;
}

class GmailError extends Error {
  constructor(message, code, statusCode, retryAfter) {
    super(message);
    this.name = "GmailError";
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = esReintentable(statusCode);
    this.isPermanent = esPermanente(statusCode);
    // Segundos que pide esperar el proveedor antes de reintentar.
    this.retryAfter = retryAfter;
  }
}

// Crear mensaje MIME para Gmail
function createMimeMessage(to, subject, body) {
  const mimeMessage = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  return Buffer.from(mimeMessage).toString("base64url");
}

async function sendEmail({ params, connection, context }) {
  if (!connection?.accessToken) {
    throw new GmailError("Token de Gmail no disponible", "MISSING_TOKEN", 401);
  }

  const { to, subject, body, userId = "me" } = params;

  if (!to) {
    throw new GmailError("to es requerido", "MISSING_TO", 400);
  }

  if (!subject) {
    throw new GmailError("subject es requerido", "MISSING_SUBJECT", 400);
  }

  if (!body) {
    throw new GmailError("body es requerido", "MISSING_BODY", 400);
  }

  const encodedMessage = createMimeMessage(to, subject, body);
  const url = `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/send`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedMessage }),
      timeout: 10000,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const retryAfter = Number(response.headers.get("retry-after"));
      throw new GmailError(
        error.error?.message || "Error en Gmail",
        error.error?.code || "UNKNOWN_ERROR",
        response.status,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
      );
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.id,
      threadId: result.threadId,
      rawResponse: result,
    };
  } catch (error) {
    if (error instanceof GmailError) throw error;
    throw new GmailError(error.message, "NETWORK_ERROR", 0);
  }
}

module.exports = {
  send_email: sendEmail,
  GmailError,
};
