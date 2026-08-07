const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/requireAuth");
const { automationSchema, updateSchema } = require("../validators/automations");
const service = require("../services/automations");
const { createExecutionsQueue } = require("../../shared/queue");

const router = express.Router();

// Todas las rutas son privadas: el userId se toma de la sesión.
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (request, response) => {
    response.json(await service.list(request.userId));
  }),
);

router.get(
  "/:id",
  asyncHandler(async (request, response) => {
    response.json(await service.getById(request.userId, request.params.id));
  }),
);

router.post(
  "/",
  asyncHandler(async (request, response) => {
    const parsed = automationSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const creada = await service.create(request.userId, parsed.data);
    response.status(201).json(creada);
  }),
);

router.put(
  "/:id",
  asyncHandler(async (request, response) => {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const actualizada = await service.update(request.userId, request.params.id, parsed.data);
    response.json(actualizada);
  }),
);

router.patch(
  "/:id/toggle",
  asyncHandler(async (request, response) => {
    response.json(await service.toggle(request.userId, request.params.id));
  }),
);

router.post(
  "/:id/dispatch",
  asyncHandler(async (request, response) => {
    const queue = createExecutionsQueue();
    const job = await queue.add("run-automation", {
      automationId: request.params.id,
      eventId: request.body?.eventId || `event-${Date.now()}`,
      triggerData: request.body?.triggerData || {},
      version: 1,
    });
    await queue.close();
    response.status(202).json({ accepted: true, jobId: job.id });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    await service.remove(request.userId, request.params.id);
    response.status(204).end();
  }),
);

module.exports = { automationsRouter: router };
