const { z } = require("zod");

// El correo se normaliza para que "Juan@UTN.ac.cr" y "juan@utn.ac.cr"
// no puedan registrarse como dos cuentas distintas.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("El correo no tiene un formato válido");

const password = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(128, "La contraseña es demasiado larga");

const registerSchema = z.object({ email, password });

// En el inicio de sesión no se valida el largo: una contraseña vieja o
// incorrecta debe fallar por credenciales, no por formato.
const loginSchema = z.object({ email, password: z.string().min(1) });

module.exports = { registerSchema, loginSchema };
