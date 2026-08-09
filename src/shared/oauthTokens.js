// Obtención de tokens de acceso válidos, con renovación automática.
//
// Vive en shared/ porque lo necesitan los dos procesos: la API cuando actúa en
// nombre del usuario, y el worker antes de cada acción contra un proveedor.
// Estaba solo en el servicio de la API, así que el worker usaba el token
// guardado tal cual y toda acción de Gmail fallaba con 401 una hora después
// de conectar la cuenta, que es cuando caduca.
const { env } = require("../config");
const { prisma } = require("./prisma");
const { encryptToken, decryptToken } = require("./tokenCrypto");

// Se renueva un minuto antes del vencimiento real, para que un token no expire
// entre que se lee y se usa.
const MARGEN_MS = 60_000;

class TokenError extends Error {
  constructor(code, message, { permanent = false } = {}) {
    super(message);
    this.name = "TokenError";
    this.code = code;
    this.statusCode = 401;
    // Reautorizar requiere que la persona vuelva a dar permiso: reintentar
    // no cambia nada, así que se marca como permanente y no se reintenta.
    this.isPermanent = permanent;
    this.isRetryable = !permanent;
  }
}

async function refrescarGoogle(refreshToken) {
  const config = env.google;
  if (!config?.clientId || !config.clientSecret) {
    throw new TokenError("GOOGLE_OAUTH_NOT_CONFIGURED", "Faltan las credenciales de Google", {
      permanent: true,
    });
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokens = await response.json().catch(() => ({}));

  if (!response.ok || !tokens.access_token) {
    // Un refresh token revocado o caducado (en modo Testing dura 7 días) no se
    // arregla reintentando: hay que volver a conectar la cuenta.
    throw new TokenError(
      "GOOGLE_REAUTHORIZATION_REQUIRED",
      tokens.error_description || "No se pudo renovar el acceso a Google. Reconectá la cuenta.",
      { permanent: true },
    );
  }

  return tokens;
}

/**
 * Devuelve un token de acceso utilizable para la conexión indicada,
 * renovándolo y guardándolo si está por vencer.
 * @param {object} connection fila del modelo Connection
 */
async function getValidAccessToken(connection) {
  if (!connection?.accessTokenEncrypted) return null;

  const accessToken = decryptToken(connection.accessTokenEncrypted);

  // Los tokens de GitHub no expiran, así que se usan tal cual.
  if (connection.provider !== "GOOGLE") return accessToken;

  const vigente = connection.expiresAt && connection.expiresAt.getTime() > Date.now() + MARGEN_MS;
  if (vigente) return accessToken;

  if (!connection.refreshTokenEncrypted) {
    throw new TokenError(
      "GOOGLE_REAUTHORIZATION_REQUIRED",
      "El acceso a Google venció y no hay token de refresco. Reconectá la cuenta.",
      { permanent: true },
    );
  }

  const tokens = await refrescarGoogle(decryptToken(connection.refreshTokenEncrypted));

  await prisma.connection.update({
    where: { id: connection.id },
    data: {
      accessTokenEncrypted: encryptToken(tokens.access_token),
      expiresAt: new Date(Date.now() + Number(tokens.expires_in) * 1000),
      // Google no siempre devuelve uno nuevo; si lo hace, se reemplaza.
      ...(tokens.refresh_token ? { refreshTokenEncrypted: encryptToken(tokens.refresh_token) } : {}),
    },
  });

  return tokens.access_token;
}

module.exports = { getValidAccessToken, TokenError };
