const assert = require("node:assert/strict");
const test = require("node:test");
const { automationSchema } = require("../src/api/validators/automations");

function validAutomation() {
  return {
    name: "  Avisar sobre issues  ",
    enabled: true,
    triggerType: "GITHUB_WEBHOOK",
    triggerConfig: { owner: "equipo", repo: "flowhub", event: "issues" },
    conditions: [{ field: "trigger.action", operator: "eq", value: "opened" }],
    actions: [{
      provider: "TELEGRAM",
      actionType: "send_message",
      params: { chatId: "123", text: "{{trigger.title}}" },
    }],
  };
}

test("acepta y normaliza una automatización completa", () => {
  const parsed = automationSchema.parse(validAutomation());
  assert.equal(parsed.name, "Avisar sobre issues");
  assert.equal(parsed.actions[0].actionType, "send_message");
  assert.equal(parsed.conditions[0].operator, "eq");
});

test("aplica valores predeterminados a campos opcionales", () => {
  const input = validAutomation();
  delete input.enabled;
  delete input.conditions;
  const parsed = automationSchema.parse(input);
  assert.equal(parsed.enabled, true);
  assert.deepEqual(parsed.conditions, []);
});

test("rechaza automatizaciones sin nombre o sin acciones", () => {
  const input = validAutomation();
  input.name = " ";
  input.actions = [];
  const result = automationSchema.safeParse(input);
  assert.equal(result.success, false);
  assert.ok(result.error.flatten().fieldErrors.name);
  assert.ok(result.error.flatten().fieldErrors.actions);
});

test("rechaza triggers, proveedores y operadores desconocidos", () => {
  const input = validAutomation();
  input.triggerType = "DESCONOCIDO";
  input.actions[0].provider = "DESCONOCIDO";
  input.conditions[0].operator = "DESCONOCIDO";
  assert.equal(automationSchema.safeParse(input).success, false);
});
