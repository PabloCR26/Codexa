// Tarea 56: operadores de condiciones y detención de la automatización.
const assert = require("node:assert/strict");
const test = require("node:test");
const { evaluateCondition, runAutomation } = require("../src/worker/engine");

// Datos como los arma el webhook: planos, mas el envoltorio "trigger" que
// agrega el motor para admitir la forma {{trigger.campo}}.
const datos = {
  action: "opened",
  title: "Error al iniciar sesion",
  comentarios: 5,
  autor: { login: "eliam" },
};
const contexto = { ...datos, trigger: datos };

test("el operador eq compara por igualdad", () => {
  assert.equal(evaluateCondition({ field: "action", operator: "eq", value: "opened" }, contexto), true);
  assert.equal(evaluateCondition({ field: "action", operator: "eq", value: "closed" }, contexto), false);
});

test("el operador neq compara por diferencia", () => {
  assert.equal(evaluateCondition({ field: "action", operator: "neq", value: "closed" }, contexto), true);
  assert.equal(evaluateCondition({ field: "action", operator: "neq", value: "opened" }, contexto), false);
});

test("el operador contains busca dentro del texto", () => {
  assert.equal(evaluateCondition({ field: "title", operator: "contains", value: "Error" }, contexto), true);
  assert.equal(evaluateCondition({ field: "title", operator: "contains", value: "exito" }, contexto), false);
});

test("los operadores gt y lt comparan numeros, no texto", () => {
  assert.equal(evaluateCondition({ field: "comentarios", operator: "gt", value: "3" }, contexto), true);
  assert.equal(evaluateCondition({ field: "comentarios", operator: "gt", value: "10" }, contexto), false);
  assert.equal(evaluateCondition({ field: "comentarios", operator: "lt", value: "10" }, contexto), true);
  assert.equal(evaluateCondition({ field: "comentarios", operator: "lt", value: "3" }, contexto), false);

  // Comparadas como texto, "5" seria mayor que "10"; deben tratarse como numeros.
  assert.equal(evaluateCondition({ field: "comentarios", operator: "lt", value: "10" }, contexto), true);
});

test("las condiciones aceptan campos anidados y la forma trigger.campo", () => {
  assert.equal(evaluateCondition({ field: "autor.login", operator: "eq", value: "eliam" }, contexto), true);
  assert.equal(evaluateCondition({ field: "trigger.action", operator: "eq", value: "opened" }, contexto), true);
});

test("un campo inexistente no cumple la condicion", () => {
  assert.equal(evaluateCondition({ field: "noExiste", operator: "eq", value: "algo" }, contexto), false);
  assert.equal(evaluateCondition({ field: "autor.correo", operator: "contains", value: "@" }, contexto), false);
});

// Prisma falso: solo lo necesario para que runAutomation avance.
function crearPrismaFalso(automation) {
  const executions = [];
  return {
    executions,
    automation: { findUnique: async () => automation },
    execution: {
      findUnique: async () => null,
      create: async ({ data }) => {
        const fila = { id: "exec-1", ...data };
        executions.push(fila);
        return fila;
      },
      update: async ({ data }) => {
        Object.assign(executions[0], data);
        return executions[0];
      },
    },
    connection: { findFirst: async () => null },
  };
}

test("una condicion no cumplida detiene la automatizacion sin ejecutar acciones", async () => {
  const automation = {
    id: "auto-1",
    userId: "user-1",
    enabled: true,
    triggerType: "GITHUB_WEBHOOK",
    conditions: [{ field: "action", operator: "eq", value: "closed" }],
    actions: [{ provider: "TELEGRAM", actionType: "send_message", params: {} }],
  };
  const prismaClient = crearPrismaFalso(automation);

  const resultado = await runAutomation(
    { automationId: "auto-1", eventId: "evt-1", triggerData: datos },
    { prismaClient },
  );

  assert.equal(resultado.status, "SKIPPED");
  assert.equal(prismaClient.executions[0].status, "SKIPPED");
  assert.equal(prismaClient.executions[0].output.reason, "conditions_not_met");
});

test("todas las condiciones deben cumplirse para continuar", async () => {
  const automation = {
    id: "auto-2",
    userId: "user-1",
    enabled: true,
    triggerType: "GITHUB_WEBHOOK",
    conditions: [
      { field: "action", operator: "eq", value: "opened" }, // se cumple
      { field: "comentarios", operator: "gt", value: "100" }, // no se cumple
    ],
    actions: [{ provider: "TELEGRAM", actionType: "send_message", params: {} }],
  };
  const prismaClient = crearPrismaFalso(automation);

  const resultado = await runAutomation(
    { automationId: "auto-2", eventId: "evt-2", triggerData: datos },
    { prismaClient },
  );

  assert.equal(resultado.status, "SKIPPED");
});

test("las condiciones con operadores lógicos combinan AND y OR entre reglas", () => {
  const contextoConcreto = { ...datos, trigger: datos, estado: "open" };
  assert.equal(
    evaluateCondition({
      type: "group",
      operator: "OR",
      conditions: [
        { field: "action", operator: "eq", value: "closed" },
        { field: "estado", operator: "eq", value: "open" },
      ],
    }, contextoConcreto),
    true,
  );
  assert.equal(
    evaluateCondition({
      type: "group",
      operator: "AND",
      conditions: [
        { field: "action", operator: "eq", value: "opened" },
        { field: "estado", operator: "eq", value: "open" },
      ],
    }, contextoConcreto),
    true,
  );
});
