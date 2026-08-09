// Registry de adaptadores: mapea provider + action a su handler
// Los adaptadores deben exportar una función con firma:
// async ({ params, connection, context }) => resultado

const telegramAdapters = require("./telegram");
const githubAdapters = require("./github");
const gmailAdapters = require("./gmail");

// Las claves deben ser exactamente los valores del enum Provider de
// prisma/schema.prisma: GOOGLE, GITHUB y TELEGRAM. La automatización guarda el
// proveedor con ese nombre y con ese nombre se busca la conexión OAuth.
// Estaba como GMAIL, que es el servicio pero no el proveedor, y por eso toda
// acción de correo fallaba con "Proveedor no soportado: GOOGLE".
const adapters = {
  TELEGRAM: telegramAdapters,
  GITHUB: githubAdapters,
  GOOGLE: gmailAdapters,
};

/**
 * Obtiene el handler de una acción
 * @param {string} provider - Proveedor: TELEGRAM, GITHUB, GOOGLE
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
