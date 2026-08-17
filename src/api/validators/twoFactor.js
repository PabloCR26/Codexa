const { z } = require("zod");

const verifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código TOTP debe tener 6 dígitos"),
});

const disableSchema = z.object({
  password: z.string().min(1, "La contraseña es obligatoria"),
});

module.exports = { verifySchema, disableSchema };