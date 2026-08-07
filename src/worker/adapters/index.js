// Registry de adaptadores: mapea provider + action a su handler
// Los adaptadores deben exportar una función con firma:
// async ({ params, connection, context }) => resultado

const telegramAdapters = require("./telegram");
const githubAdapters = require("./github");
const gmailAdapters = require("./gmail");

const adapters = {
  TELEGRAM: telegramAdapters,
  GITHUB: githubAdapters,
  GMAIL: gmailAdapters,
};

/**
 * Obtiene el handler de una acción
 * @param {string} provider - Proveedor: TELEGRAM, GITHUB, GMAIL
 * @param {string} action - Tipo de acción: send_message, create_issue, send_email
 * @returns {Function} Handler de la acción
 */
function getAdapter(provider, action) {
  const providerAdapters = adapters[provider];
  if (!providerAdapters) {
    throw new Error(`Proveedor no soportado: ${provider}`);
  }

  const handler = providerAdapters[action];
  if (!handler) {
    throw new Error(`Acción no soportada para ${provider}: ${action}`);
  }

  return handler;
}

module.exports = { getAdapter, adapters };
