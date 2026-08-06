const assert = require("node:assert/strict");
const test = require("node:test");
const { publicConnection } = require("../src/api/services/connections");

test("la respuesta pública de conexiones nunca incluye tokens", () => {
  const connection = publicConnection({
    id: "connection-1",
    provider: "GOOGLE",
    accessTokenEncrypted: "v1:access-token-cifrado",
    refreshTokenEncrypted: "v1:refresh-token-cifrado",
    expiresAt: new Date("2026-08-06T12:00:00.000Z"),
    metadata: { email: "usuario@example.com" },
    createdAt: new Date("2026-08-06T10:00:00.000Z"),
    updatedAt: new Date("2026-08-06T11:00:00.000Z"),
  });

  assert.equal(connection.id, "connection-1");
  assert.equal(connection.provider, "GOOGLE");
  assert.equal(Object.hasOwn(connection, "accessTokenEncrypted"), false);
  assert.equal(Object.hasOwn(connection, "refreshTokenEncrypted"), false);
  assert.equal(JSON.stringify(connection).includes("token-cifrado"), false);
});
