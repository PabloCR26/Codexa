const { prisma } = require("../../shared/prisma");

// Regla de aislamiento: TODAS las consultas de este servicio reciben el
// userId de la sesión y lo incluyen en el where. Nunca se busca una
// automatización solo por su id, porque eso permitiría leer o modificar
// la de otro usuario conociendo el identificador.
//
// La programación de los disparadores CRON no se maneja aquí: es
// responsabilidad del worker, que reconcilia periódicamente las
// programaciones de BullMQ con las automatizaciones activas
// (ver src/worker/scheduler.js). Mantenerlo así evita que la API abra
// conexiones a Redis dentro de una petición y respeta la separación entre
// productor y consumidor.

class NotFoundError extends Error {
  constructor() {
    super("AUTOMATION_NOT_FOUND");
    this.code = "AUTOMATION_NOT_FOUND";
    this.status = 404;
  }
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
    return prismaClient.automation.create({ data: { ...datos, userId } });
  }

  async function update(userId, id, datos) {
    // Se confirma la pertenencia antes de modificar: updateMany con userId
    // evita que un id ajeno afecte datos de otro usuario.
    const resultado = await prismaClient.automation.updateMany({
      where: { id, userId },
      data: datos,
    });
    if (resultado.count === 0) throw new NotFoundError();
    return getById(userId, id);
  }

  async function toggle(userId, id) {
    const actual = await getById(userId, id);
    return prismaClient.automation.update({
      where: { id: actual.id },
      data: { enabled: !actual.enabled },
    });
  }

  async function remove(userId, id) {
    const resultado = await prismaClient.automation.deleteMany({ where: { id, userId } });
    if (resultado.count === 0) throw new NotFoundError();
  }

  return { list, getById, create, update, toggle, remove };
}

const automationService = createAutomationService();

module.exports = { ...automationService, createAutomationService, NotFoundError };
