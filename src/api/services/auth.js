const bcrypt = require("bcryptjs");
const speakeasy = require("speakeasy");
const { prisma } = require("../../shared/prisma");

// Costo del hash. 12 es un equilibrio razonable entre seguridad y tiempo
// de respuesta; subirlo encarece los ataques por fuerza bruta.
const SALT_ROUNDS = 12;

// Campos que se pueden devolver al cliente. Nunca se expone passwordHash
// ni totpSecret.
const PUBLIC_FIELDS = {
  id: true,
  email: true,
  totpEnabled: true,
  createdAt: true,
};

class AuthError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function createAuthService({ prismaClient = prisma, passwordLibrary = bcrypt, totpLibrary = speakeasy } = {}) {
  async function register({ email, password }) {
    const existente = await prismaClient.user.findUnique({ where: { email } });
    if (existente) {
      throw new AuthError("EMAIL_ALREADY_REGISTERED", 409);
    }

    const passwordHash = await passwordLibrary.hash(password, SALT_ROUNDS);

    try {
      return await prismaClient.user.create({
        data: { email, passwordHash },
        select: PUBLIC_FIELDS,
      });
    } catch (error) {
      // Dos solicitudes simultáneas pueden superar el findUnique. La restricción
      // única de PostgreSQL sigue siendo la autoridad y debe producir el mismo 409.
      if (error?.code === "P2002") {
        throw new AuthError("EMAIL_ALREADY_REGISTERED", 409);
      }
      throw error;
    }
  }

  async function login({ email, password, code }) {
    const user = await prismaClient.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        totpEnabled: true,
        totpSecret: true,
        createdAt: true,
      },
    });

    // Se compara aunque el usuario no exista para que el tiempo de respuesta
    // sea parecido en ambos casos y no revele qué correos están registrados.
    const hash = user
      ? user.passwordHash
      : "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
    const coincide = await passwordLibrary.compare(password, hash);

    if (!user || !coincide) {
      throw new AuthError("INVALID_CREDENTIALS", 401);
    }

    if (user.totpEnabled) {
      if (!user.totpSecret || !code) {
        throw new AuthError("TOTP_REQUIRED", 401);
      }

      const valid = totpLibrary.totp.verify({
        secret: user.totpSecret,
        encoding: "base32",
        token: code,
        window: 1,
      });

      if (!valid) {
        throw new AuthError("INVALID_TOTP_CODE", 401);
      }
    }

    return {
      id: user.id,
      email: user.email,
      totpEnabled: user.totpEnabled,
      createdAt: user.createdAt,
    };
  }

  function findById(id) {
    return prismaClient.user.findUnique({ where: { id }, select: PUBLIC_FIELDS });
  }

  return { register, login, findById };
}

const authService = createAuthService();

module.exports = { ...authService, createAuthService, AuthError };
