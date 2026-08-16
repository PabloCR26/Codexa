const { z } = require("zod");

const verifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código TOTP debe tener 6 dígitos"),
});

module.exports = { verifySchema };