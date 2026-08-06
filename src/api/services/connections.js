const { prisma } = require("../../shared/prisma");
const { decryptToken, encryptToken } = require("../../shared/tokenCrypto");
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

async function getValidAccessToken(userId, provider) {
  const providerName = PROVIDERS[provider];
  const connection = await prisma.connection.findUnique({
    where: { userId_provider: { userId, provider: providerName } },
  });
  if (!connection?.accessTokenEncrypted) throw new ConnectionNotFoundError();
  const accessToken = decryptToken(connection.accessTokenEncrypted);
  if (provider !== "google" || !connection.expiresAt || connection.expiresAt.getTime() > Date.now() + 60_000) {
    return accessToken;
  }
  if (!connection.refreshTokenEncrypted) throw new providers.OAuthError("GOOGLE_REAUTHORIZATION_REQUIRED", 401);
  const refreshed = await providers.refreshGoogleToken(decryptToken(connection.refreshTokenEncrypted));
  await prisma.connection.update({
    where: { id: connection.id },
    data: {
      accessTokenEncrypted: encryptToken(refreshed.access_token),
      expiresAt: new Date(Date.now() + Number(refreshed.expires_in) * 1000),
      ...(refreshed.refresh_token ? { refreshTokenEncrypted: encryptToken(refreshed.refresh_token) } : {}),
    },
  });
  return refreshed.access_token;
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
