// Adaptador para Telegram
// Envía mensajes a través del bot de Telegram

const { env } = require("../../config");

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

class TelegramError extends Error {
  constructor(message, code, statusCode, retryAfter) {
    super(message);
    this.name = "TelegramError";
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = esReintentable(statusCode);
    this.isPermanent = esPermanente(statusCode);
    // Segundos que pide esperar el proveedor antes de reintentar.
    this.retryAfter = retryAfter;
  }
}

async function sendMessage({ params, connection, context }) {
  if (!env.telegramBotToken) {
    throw new TelegramError("Token de Telegram no configurado", "MISSING_TOKEN", 500);
  }

  // El formulario guarda el mensaje como "text" (ver el catálogo en
  // web/src/JS/automationCatalog.js). El adaptador leía solo "message", así que
  // toda acción de Telegram creada desde la interfaz fallaba con
  // MISSING_MESSAGE. Se acepta "message" como alias por compatibilidad.
  const { chatId, parseMode = "HTML" } = params;
  const texto = params.text ?? params.message;

  if (!chatId) {
    throw new TelegramError("chatId es requerido", "MISSING_CHAT_ID", 400);
  }

  if (!texto) {
    throw new TelegramError("El mensaje es requerido", "MISSING_MESSAGE", 400);
  }

  const url = `https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: parseMode }),
      timeout: 10000,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // Telegram indica la espera en parameters.retry_after; el encabezado
      // estándar se usa como respaldo.
      const retryAfter =
        error.parameters?.retry_after ?? Number(response.headers.get("retry-after")) ?? undefined;
      throw new TelegramError(
        error.description || "Error en Telegram",
        error.error_code || "UNKNOWN_ERROR",
        response.status,
        retryAfter,
      );
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.result?.message_id,
      rawResponse: result,
    };
  } catch (error) {
    if (error instanceof TelegramError) throw error;
    throw new TelegramError(error.message, "NETWORK_ERROR", 0);
  }
}

module.exports = {
  send_message: sendMessage,
  TelegramError,
};
