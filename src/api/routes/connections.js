const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/requireAuth");
const service = require("../services/connections");

const router = express.Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (request, response) => {
    response.json(await service.list(request.userId));
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    await service.remove(request.userId, request.params.id);
    response.status(204).end();
  }),
);

module.exports = { connectionsRouter: router };
