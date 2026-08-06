const bcrypt = require("bcryptjs");
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

async function register({ email, password }) {
  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    throw new AuthError("EMAIL_ALREADY_REGISTERED", 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return prisma.user.create({
    data: { email, passwordHash },
    select: PUBLIC_FIELDS,
  });
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Se compara aunque el usuario no exista para que el tiempo de respuesta
  // sea parecido en ambos casos y no revele qué correos están registrados.
  const hash = user ? user.passwordHash : "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
  const coincide = await bcrypt.compare(password, hash);

  if (!user || !coincide) {
    throw new AuthError("INVALID_CREDENTIALS", 401);
  }

  // TODO (tarea 64): si user.totpEnabled, exigir el código OTP antes
  // de considerar el inicio de sesión completo.

  return {
    id: user.id,
    email: user.email,
    totpEnabled: user.totpEnabled,
    createdAt: user.createdAt,
  };
}

function findById(id) {
  return prisma.user.findUnique({ where: { id }, select: PUBLIC_FIELDS });
}

module.exports = { register, login, findById, AuthError };
