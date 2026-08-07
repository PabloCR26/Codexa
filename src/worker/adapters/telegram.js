// Adaptador para Telegram
// Envía mensajes a través del bot de Telegram

const { env } = require("../../config");

// Errores permanentes: 4xx (excepto 429)
// Errores reintentables: 429 y 5xx
const PERMANENT_ERRORS = /^4[0-2]\d|^4[3-9]\d/;
const RETRYABLE_ERRORS = /^429|^5\d\d/;

class TelegramError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = "TelegramError";
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = RETRYABLE_ERRORS.test(String(statusCode));
    this.isPermanent = PERMANENT_ERRORS.test(String(statusCode));
  }
}

async function sendMessage({ params, connection, context }) {
  if (!env.telegramBotToken) {
    throw new TelegramError("Token de Telegram no configurado", "MISSING_TOKEN", 500);
  }

  const { chatId, message, parseMode = "HTML" } = params;

  if (!chatId) {
    throw new TelegramError("chatId es requerido", "MISSING_CHAT_ID", 400);
  }

  if (!message) {
    throw new TelegramError("message es requerido", "MISSING_MESSAGE", 400);
  }

  const url = `https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: parseMode }),
      timeout: 10000,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new TelegramError(
        error.description || "Error en Telegram",
        error.error_code || "UNKNOWN_ERROR",
        response.status,
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
