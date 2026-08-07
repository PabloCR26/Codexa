const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createAutomationService,
  NotFoundError,
} = require("../src/api/services/automations");

function createFakePrisma(initialRows = []) {
  const rows = initialRows.map((row) => ({ ...row }));
  const calls = [];
  return {
    rows,
    calls,
    client: {
      automation: {
        findMany: async (args) => {
          calls.push(["findMany", args]);
          return rows.filter((row) => row.userId === args.where.userId);
        },
        findFirst: async (args) => {
          calls.push(["findFirst", args]);
          return rows.find((row) => row.id === args.where.id && row.userId === args.where.userId) || null;
        },
        create: async (args) => {
          calls.push(["create", args]);
          const row = { id: `automation-${rows.length + 1}`, ...args.data };
          rows.push(row);
          return row;
        },
        updateMany: async (args) => {
          calls.push(["updateMany", args]);
          const row = rows.find((item) => item.id === args.where.id && item.userId === args.where.userId);
          if (!row) return { count: 0 };
          Object.assign(row, args.data);
          return { count: 1 };
        },
        update: async (args) => {
          calls.push(["update", args]);
          const row = rows.find((item) => item.id === args.where.id);
          Object.assign(row, args.data);
          return row;
        },
        deleteMany: async (args) => {
          calls.push(["deleteMany", args]);
          const index = rows.findIndex((row) => row.id === args.where.id && row.userId === args.where.userId);
          if (index === -1) return { count: 0 };
          rows.splice(index, 1);
          return { count: 1 };
        },
      },
    },
  };
}

const baseAutomation = {
  id: "automation-1",
  userId: "user-1",
  name: "Original",
  enabled: true,
  triggerType: "CRON",
  triggerConfig: { expression: "0 9 * * *" },
  conditions: [],
  actions: [{ provider: "TELEGRAM", actionType: "send_message", params: { chatId: "123", text: "Hola" } }],
};

test("lista únicamente automatizaciones del usuario autenticado", async () => {
  const database = createFakePrisma([
    baseAutomation,
    { ...baseAutomation, id: "automation-2", userId: "user-2" },
  ]);
  const service = createAutomationService({ prismaClient: database.client });
  const result = await service.list("user-1");
  assert.deepEqual(result.map((row) => row.id), ["automation-1"]);
  assert.deepEqual(database.calls[0][1].where, { userId: "user-1" });
});

test("crea la automatización asignando el userId de la sesión", async () => {
  const database = createFakePrisma();
  const service = createAutomationService({ prismaClient: database.client });
  const created = await service.create("user-1", { ...baseAutomation, id: undefined, userId: undefined });
  assert.equal(created.userId, "user-1");
  assert.equal(database.calls[0][1].data.userId, "user-1");
});

test("edita y alterna el estado solamente cuando el recurso pertenece al usuario", async () => {
  const database = createFakePrisma([baseAutomation]);
  const service = createAutomationService({ prismaClient: database.client });
  const updated = await service.update("user-1", "automation-1", { name: "Editada" });
  const toggled = await service.toggle("user-1", "automation-1");
  assert.equal(updated.name, "Editada");
  assert.equal(toggled.enabled, false);
  await assert.rejects(
    service.update("user-2", "automation-1", { name: "Intrusión" }),
    (error) => error instanceof NotFoundError && error.status === 404,
  );
});

test("elimina por id y userId y devuelve 404 para recursos ajenos", async () => {
  const database = createFakePrisma([baseAutomation]);
  const service = createAutomationService({ prismaClient: database.client });
  await assert.rejects(
    service.remove("user-2", "automation-1"),
    (error) => error.code === "AUTOMATION_NOT_FOUND" && error.status === 404,
  );
  assert.equal(database.rows.length, 1);
  await service.remove("user-1", "automation-1");
  assert.equal(database.rows.length, 0);
});
