const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcryptjs");
const { createAuthService, AuthError } = require("../src/api/services/auth");
const { registerSchema } = require("../src/api/validators/auth");

function fakePrisma(existingUser = null) {
  const state = { createArguments: null };
  return {
    state,
    client: {
      user: {
        findUnique: async () => existingUser,
        create: async (arguments_) => {
          state.createArguments = arguments_;
          return {
            id: "user-1",
            email: arguments_.data.email,
            totpEnabled: false,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          };
        },
      },
    },
  };
}

test("el registro normaliza el correo, cifra la contraseña y no devuelve el hash", async () => {
  const parsed = registerSchema.parse({
    email: "  Estudiante@UTN.AC.CR ",
    password: "clave-segura-123",
  });
  const database = fakePrisma();
  const service = createAuthService({ prismaClient: database.client });

  const user = await service.register(parsed);
  const stored = database.state.createArguments.data;

  assert.equal(user.email, "estudiante@utn.ac.cr");
  assert.equal(Object.hasOwn(user, "passwordHash"), false);
  assert.notEqual(stored.passwordHash, parsed.password);
  assert.equal(await bcrypt.compare(parsed.password, stored.passwordHash), true);
  assert.deepEqual(database.state.createArguments.select, {
    id: true,
    email: true,
    totpEnabled: true,
    createdAt: true,
  });
});

test("rechaza correos inválidos y contraseñas menores de ocho caracteres", () => {
  const result = registerSchema.safeParse({ email: "correo-invalido", password: "corta" });
  assert.equal(result.success, false);
  assert.ok(result.error.flatten().fieldErrors.email);
  assert.ok(result.error.flatten().fieldErrors.password);
});

test("rechaza un correo que ya está registrado con estado 409", async () => {
  const database = fakePrisma({ id: "existing-user" });
  const service = createAuthService({ prismaClient: database.client });

  await assert.rejects(
    service.register({ email: "existente@example.com", password: "clave-segura-123" }),
    (error) => error instanceof AuthError &&
      error.code === "EMAIL_ALREADY_REGISTERED" &&
      error.status === 409,
  );
  assert.equal(database.state.createArguments, null);
});

test("convierte una colisión concurrente de correo en el mismo error 409", async () => {
  const database = fakePrisma();
  database.client.user.create = async () => {
    const error = new Error("Unique constraint failed");
    error.code = "P2002";
    throw error;
  };
  const passwordLibrary = { hash: async () => "hash-de-prueba", compare: bcrypt.compare };
  const service = createAuthService({ prismaClient: database.client, passwordLibrary });

  await assert.rejects(
    service.register({ email: "simultaneo@example.com", password: "clave-segura-123" }),
    (error) => error.code === "EMAIL_ALREADY_REGISTERED" && error.status === 409,
  );
});
