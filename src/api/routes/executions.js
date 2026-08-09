const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/requireAuth");
const { listQuerySchema } = require("../validators/executions");
const service = require("../services/executions");

const router = express.Router();

// Toda la bitácora es privada: el userId sale de la sesión.
router.use(requireAuth);

// GET /api/executions?status=FAILED&page=1&pageSize=20
router.get(
  "/",
  asyncHandler(async (request, response) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return response.status(400).json({
        error: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    response.json(await service.list(request.userId, parsed.data));
  }),
);

// Contadores por estado, para el encabezado de la bitácora.
router.get(
  "/summary",
  asyncHandler(async (request, response) => {
    response.json(await service.summary(request.userId));
  }),
);

module.exports = { executionsRouter: router };
