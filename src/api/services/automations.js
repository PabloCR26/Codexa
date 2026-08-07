const { prisma } = require("../../shared/prisma");
const { createExecutionsQueue } = require("../../shared/queue");
const { buildCronJobName } = require("../../worker/scheduler");

// Regla de aislamiento: TODAS las consultas de este servicio reciben el
// userId de la sesión y lo incluyen en el where. Nunca se busca una
// automatización solo por su id, porque eso permitiría leer o modificar
// la de otro usuario conociendo el identificador.

class NotFoundError extends Error {
  constructor() {
    super("AUTOMATION_NOT_FOUND");
    this.code = "AUTOMATION_NOT_FOUND";
    this.status = 404;
  }
}

async function syncCronJobs(prismaClient, automation) {
  if (automation.triggerType !== "CRON") {
    return;
  }

  const queue = createExecutionsQueue();
  const jobName = buildCronJobName(automation.id);

  if (!automation.enabled) {
    await queue.remove(jobName);
    await queue.close();
    return;
  }

  await queue.add(
    jobName,
    {
      automationId: automation.id,
      eventId: `cron-${Date.now()}`,
      triggerData: {
        expression: automation.triggerConfig?.expression || "",
        automationName: automation.name,
      },
      version: 1,
    },
    {
      repeat: { pattern: automation.triggerConfig?.expression || "0 * * * *" },
      jobId: jobName,
    },
  );
  await queue.close();
}

function createAutomationService({ prismaClient = prisma } = {}) {
  function list(userId) {
    return prismaClient.automation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async function getById(userId, id) {
    const automation = await prismaClient.automation.findFirst({ where: { id, userId } });
    if (!automation) throw new NotFoundError();
    return automation;
  }

  async function create(userId, datos) {
    const created = await prismaClient.automation.create({ data: { ...datos, userId } });
    await syncCronJobs(prismaClient, created);
    return created;
  }

  async function update(userId, id, datos) {
    // Se confirma la pertenencia antes de modificar: updateMany con userId
    // evita que un id ajeno afecte datos de otro usuario.
    const resultado = await prismaClient.automation.updateMany({
      where: { id, userId },
      data: datos,
    });
    if (resultado.count === 0) throw new NotFoundError();
    const updated = await getById(userId, id);
    await syncCronJobs(prismaClient, updated);
    return updated;
  }

  async function toggle(userId, id) {
    const actual = await getById(userId, id);
    const updated = await prismaClient.automation.update({
      where: { id: actual.id },
      data: { enabled: !actual.enabled },
    });
    await syncCronJobs(prismaClient, updated);
    return updated;
  }

  async function remove(userId, id) {
    const resultado = await prismaClient.automation.deleteMany({ where: { id, userId } });
    if (resultado.count === 0) throw new NotFoundError();
    const queue = createExecutionsQueue();
    await queue.remove(buildCronJobName(id));
    await queue.close();
  }

  return { list, getById, create, update, toggle, remove };
}

const automationService = createAutomationService();

module.exports = { ...automationService, createAutomationService, NotFoundError };
