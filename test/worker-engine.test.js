const assert = require("node:assert/strict");
const test = require("node:test");
const { runAutomation } = require("../src/worker/engine");

function createFakePrisma() {
  const executions = [];
  const calls = [];
  return {
    executions,
    calls,
    client: {
      automation: {
        findUnique: async ({ where }) => {
          calls.push(["automation.findUnique", where]);
          return {
            id: where.id,
            userId: "user-1",
            enabled: true,
            triggerType: "CRON",
            triggerConfig: { expression: "0 9 * * *" },
            conditions: [],
            actions: [{ provider: "TELEGRAM", actionType: "send_message", params: { chatId: "123", message: "Hola" } }],
          };
        },
      },
      execution: {
        findUnique: async ({ where }) => {
          calls.push(["execution.findUnique", where]);
          return executions.find((execution) => execution.automationId === where.automationId && execution.eventId === where.eventId) || null;
        },
        create: async ({ data }) => {
          calls.push(["execution.create", data]);
          const execution = { id: `execution-${executions.length + 1}`, ...data };
          executions.push(execution);
          return execution;
        },
        update: async ({ where, data }) => {
          calls.push(["execution.update", { where, data }]);
          const execution = executions.find((item) => item.id === where.id);
          if (!execution) throw new Error("execution not found");
          Object.assign(execution, data);
          return execution;
        },
      },
      connection: {
        findFirst: async ({ where }) => {
          calls.push(["connection.findFirst", where]);
          return {
            id: "connection-1",
            provider: "TELEGRAM",
            accessTokenEncrypted: null,
            refreshTokenEncrypted: null,
            metadata: null,
            accessToken: "token-123",
          };
        },
      },
      triggerState: {
        findUnique: async ({ where }) => {
          calls.push(["triggerState.findUnique", where]);
          return null;
        },
        create: async ({ data }) => ({ id: "trigger-state-1", ...data }),
        update: async ({ where, data }) => ({ id: "trigger-state-1", where, data }),
      },
    },
  };
}

test("ejecuta una automatización y guarda el resultado de la ejecución", async () => {
  const database = createFakePrisma();
  const result = await runAutomation({
    automationId: "automation-1",
    eventId: "event-1",
    triggerData: { message: "Hola" },
  }, { prismaClient: database.client, adapterContext: { skipExternalCalls: true } });

  assert.equal(result.status, "SUCCEEDED");
  assert.equal(result.execution.status, "SUCCEEDED");
  assert.equal(database.executions.length, 1);
  assert.equal(database.calls[0][0], "automation.findUnique");
});
