// Adaptador para Gmail
// Envía correos a través de la API de Gmail

// Errores permanentes: 4xx (excepto 429)
// Errores reintentables: 429 y 5xx
const PERMANENT_ERRORS = /^4[0-2]\d|^4[3-9]\d/;
const RETRYABLE_ERRORS = /^429|^5\d\d/;

class GmailError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = "GmailError";
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = RETRYABLE_ERRORS.test(String(statusCode));
    this.isPermanent = PERMANENT_ERRORS.test(String(statusCode));
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
      throw new GmailError(
        error.error?.message || "Error en Gmail",
        error.error?.code || "UNKNOWN_ERROR",
        response.status,
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
