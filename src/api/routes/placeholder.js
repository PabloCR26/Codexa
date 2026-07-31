const express = require("express");

function placeholderRouter(resource) {
  const router = express.Router();
  router.use((_request, response) => {
    response.status(501).json({
      error: "NOT_IMPLEMENTED",
      message: `El módulo ${resource} está preparado pero aún no está implementado.`,
    });
  });
  return router;
}

module.exports = { placeholderRouter };
