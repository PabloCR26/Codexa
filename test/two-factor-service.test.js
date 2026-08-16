const assert = require("node:assert/strict");
const test = require("node:test");
const { createTwoFactorService, TwoFactorError } = require("../src/api/services/twoFactor");

function createFakePrisma(existingUser = { id: "user-1", email: "persona@example.com" }) {
  const state = { updates: [] };
  return {
    state,
    client: {
      user: {
        findUnique: async ({ where, select }) => {
          state.lastFindUnique = { where, select };
          if (!existingUser) return null;
          if (select?.totpSecret) {
            return existingUser;
          }
          return { id: existingUser.id, email: existingUser.email };
        },
        update: async (arguments_) => {
          state.updates.push(arguments_);
          return {
            id: existingUser.id,
            email: existingUser.email,
            totpEnabled: Boolean(arguments_.data.totpEnabled),
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          };
        },
      },
    },
  };
}

test("genera un QR y guarda el secreto TOTP al iniciar 2FA", async () => {
  const database = createFakePrisma();
  const service = createTwoFactorService({
    prismaClient: database.client,
    totpLibrary: {
      generateSecret: () => ({
        base32: "JBSWY3DPEHPK3PXP",
        otpauth_url: "otpauth://totp/FlowHub:persona@example.com?secret=JBSWY3DPEHPK3PXP",
      }),
      totp: { verify: () => true },
    },
    qrCodeLibrary: {
      toDataURL: async (input) => `qr:${input}`,
    },
  });

  const result = await service.setup("user-1");

  assert.equal(result.qrCodeDataUrl, "qr:otpauth://totp/FlowHub:persona@example.com?secret=JBSWY3DPEHPK3PXP");
  assert.equal(result.otpauthUrl, "otpauth://totp/FlowHub:persona@example.com?secret=JBSWY3DPEHPK3PXP");
  assert.equal(database.state.updates[0].data.totpSecret, "JBSWY3DPEHPK3PXP");
  assert.equal(database.state.updates[0].data.totpEnabled, false);
});

test("activa 2FA cuando el código TOTP es válido", async () => {
  const database = createFakePrisma({ id: "user-1", email: "persona@example.com", totpSecret: "JBSWY3DPEHPK3PXP" });
  const service = createTwoFactorService({
    prismaClient: database.client,
    totpLibrary: {
      generateSecret: () => ({ base32: "", otpauth_url: "" }),
      totp: { verify: () => true },
    },
    qrCodeLibrary: { toDataURL: async () => "" },
  });

  const user = await service.verify("user-1", "123456");

  assert.equal(user.totpEnabled, true);
  assert.equal(database.state.updates[0].data.totpEnabled, true);
});

test("rechaza un código TOTP inválido con estado 400", async () => {
  const database = createFakePrisma({ id: "user-1", email: "persona@example.com", totpSecret: "JBSWY3DPEHPK3PXP" });
  const service = createTwoFactorService({
    prismaClient: database.client,
    totpLibrary: {
      generateSecret: () => ({ base32: "", otpauth_url: "" }),
      totp: { verify: () => false },
    },
    qrCodeLibrary: { toDataURL: async () => "" },
  });

  await assert.rejects(
    service.verify("user-1", "000000"),
    (error) => error instanceof TwoFactorError && error.code === "INVALID_TOTP_CODE" && error.status === 400,
  );
});