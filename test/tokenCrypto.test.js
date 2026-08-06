const assert = require("node:assert/strict");
const test = require("node:test");

process.env.TOKEN_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
const { decryptToken, encryptToken } = require("../src/shared/tokenCrypto");

test("cifra tokens con AES-256-GCM sin conservar el texto original", () => {
  const token = "token-secreto-de-prueba";
  const encrypted = encryptToken(token);
  assert.match(encrypted, /^v1:[^:]+:[^:]+:[^:]+$/);
  assert.equal(encrypted.includes(token), false);
  assert.equal(decryptToken(encrypted), token);
  assert.notEqual(encryptToken(token), encrypted);
});

test("rechaza un token cifrado manipulado", () => {
  const encrypted = encryptToken("token");
  const parts = encrypted.split(":");
  parts[3] = `${parts[3].slice(0, -1)}A`;
  assert.throws(() => decryptToken(parts.join(":")));
});
