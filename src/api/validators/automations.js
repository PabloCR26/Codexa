const { z } = require("zod");

// Los valores deben coincidir con los enums de prisma/schema.prisma.
const TRIGGER_TYPES = ["GITHUB_WEBHOOK", "GMAIL_POLL", "CRON"];
const PROVIDERS = ["GOOGLE", "GITHUB", "TELEGRAM"];
const OPERADORES = ["eq", "neq", "contains", "gt", "lt"];

// Una condición compara un campo del disparador contra un valor.
const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(OPERADORES),
  value: z.string(),
});

// Una acción se ejecuta contra un proveedor. Sus parámetros admiten
// plantillas {{trigger.campo}} que resuelve el worker.
const actionSchema = z.object({
  provider: z.enum(PROVIDERS),
  actionType: z.string().min(1),
  params: z.record(z.any()).default({}),
});

const automationSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  enabled: z.boolean().default(true),
  triggerType: z.enum(TRIGGER_TYPES),
  triggerConfig: z.record(z.any()).default({}),
  conditions: z.array(conditionSchema).default([]),
  // El enunciado exige al menos una acción por automatización.
  actions: z.array(actionSchema).min(1, "Debe definir al menos una acción"),
});

// En la edición se envía el recurso completo, igual que en la creación.
const updateSchema = automationSchema;

module.exports = { automationSchema, updateSchema, TRIGGER_TYPES, PROVIDERS };
