const { prisma } = require("../../shared/prisma");
const { decryptToken, encryptToken } = require("../../shared/tokenCrypto");
const { getValidAccessToken: obtenerTokenVigente } = require("../../shared/oauthTokens");
const providers = require("./oauthProviders");

const PROVIDERS = { github: "GITHUB", google: "GOOGLE" };

class ConnectionNotFoundError extends Error {
  constructor() {
    super("CONNECTION_NOT_FOUND");
    this.code = "CONNECTION_NOT_FOUND";
    this.status = 404;
  }
}

function publicConnection(connection) {
  return {
    id: connection.id,
    provider: connection.provider,
    metadata: connection.metadata,
    expiresAt: connection.expiresAt,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

async function list(userId) {
  const rows = await prisma.connection.findMany({
    where: { userId, provider: { in: ["GOOGLE", "GITHUB"] } },
    orderBy: { provider: "asc" },
  });
  return rows.map(publicConnection);
}

async function saveOAuthConnection(userId, provider, tokens, metadata) {
  const providerName = PROVIDERS[provider];
  const expiresAt = tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000) : null;
  const existing = await prisma.connection.findUnique({
    where: { userId_provider: { userId, provider: providerName } },
  });
  const refreshTokenEncrypted = tokens.refresh_token
    ? encryptToken(tokens.refresh_token)
    : existing?.refreshTokenEncrypted || null;
  return prisma.connection.upsert({
    where: { userId_provider: { userId, provider: providerName } },
    create: {
      userId,
      provider: providerName,
      accessTokenEncrypted: encryptToken(tokens.access_token),
      refreshTokenEncrypted,
      expiresAt,
      metadata,
    },
    update: {
      accessTokenEncrypted: encryptToken(tokens.access_token),
      refreshTokenEncrypted,
      expiresAt,
      metadata,
    },
  });
}

// La renovación vive en shared/oauthTokens.js porque el worker también la
// necesita. Aquí solo se resuelve la conexión del usuario y se delega, para
// que no queden dos implementaciones que puedan desincronizarse.
async function getValidAccessToken(userId, provider) {
  const providerName = PROVIDERS[provider];
  const connection = await prisma.connection.findUnique({
    where: { userId_provider: { userId, provider: providerName } },
  });
  if (!connection?.accessTokenEncrypted) throw new ConnectionNotFoundError();
  return obtenerTokenVigente(connection);
}

async function remove(userId, id) {
  const connection = await prisma.connection.findFirst({ where: { id, userId } });
  if (!connection) throw new ConnectionNotFoundError();
  const provider = connection.provider.toLowerCase();
  await providers.revokeToken(
    provider,
    decryptToken(connection.accessTokenEncrypted),
    decryptToken(connection.refreshTokenEncrypted),
  );
  await prisma.connection.deleteMany({ where: { id, userId } });
}

module.exports = { list, saveOAuthConnection, getValidAccessToken, remove, publicConnection, ConnectionNotFoundError };
