const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/requireAuth");
const { loginRateLimit } = require("../middleware/rateLimitLogin");
const { registerSchema, loginSchema } = require("../validators/auth");
const authService = require("../services/auth");

const router = express.Router();

// Regenera el identificador de sesión al autenticar. Evita la fijación de
// sesión: un identificador obtenido antes del login deja de ser válido.
function iniciarSesion(request, userId) {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) return reject(error);
      request.session.userId = userId;
      request.session.save((errorGuardado) =>
        errorGuardado ? reject(errorGuardado) : resolve(),
      );
    });
  });
}

router.post(
  "/register",
  asyncHandler(async (request, response) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const user = await authService.register(parsed.data);
    await iniciarSesion(request, user.id);
    response.status(201).json(user);
  }),
);

router.post(
  "/login",
  loginRateLimit,
  asyncHandler(async (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({ error: "VALIDATION_ERROR" });
    }

    const user = await authService.login(parsed.data);
    await iniciarSesion(request, user.id);
    response.json(user);
  }),
);

router.post(
  "/logout",
  asyncHandler(async (request, response) => {
    if (!request.session) return response.status(204).end();

    await new Promise((resolve, reject) => {
      request.session.destroy((error) => (error ? reject(error) : resolve()));
    });

    response.clearCookie("flowhub.sid");
    response.status(204).end();
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (request, response) => {
    const user = await authService.findById(request.userId);

    // La sesión apunta a un usuario que ya no existe (por ejemplo, borrado
    // desde la base): se cierra para no dejarla en un estado inconsistente.
    if (!user) {
      return request.session.destroy(() =>
        response.status(401).json({ error: "UNAUTHENTICATED" }),
      );
    }

    response.json(user);
  }),
);

module.exports = { authRouter: router };
