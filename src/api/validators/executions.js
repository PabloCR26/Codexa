const { z } = require("zod");

// Los estados deben coincidir con el enum ExecutionStatus de schema.prisma.
const ESTADOS = ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "SKIPPED"];

// Tope de página para que una petición no pueda pedir la tabla entera.
const MAX_POR_PAGINA = 100;

const listQuerySchema = z.object({
  status: z.enum(ESTADOS).optional(),
  automationId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_POR_PAGINA).default(20),
});

module.exports = { listQuerySchema, ESTADOS, MAX_POR_PAGINA };
