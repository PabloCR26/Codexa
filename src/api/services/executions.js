const { prisma } = require("../../shared/prisma");

// Regla de aislamiento: toda consulta lleva el userId de la sesión. La bitácora
// puede contener datos sensibles del disparador, así que nadie debe poder leer
// la de otra persona conociendo el identificador.

class NotFoundError extends Error {
  constructor() {
    super("EXECUTION_NOT_FOUND");
    this.code = "EXECUTION_NOT_FOUND";
    this.status = 404;
  }
}

// En el listado no se devuelven triggerData, output ni error: son objetos que
// pueden pesar bastante y solo hacen falta en el detalle.
const CAMPOS_LISTA = {
  id: true,
  status: true,
  eventId: true,
  attempt: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  automation: { select: { id: true, name: true, triggerType: true } },
};

function createExecutionService({ prismaClient = prisma } = {}) {
  async function list(userId, { status, automationId, page, pageSize }) {
    const where = { userId };
    if (status) where.status = status;
    if (automationId) where.automationId = automationId;

    // Se piden datos y total en paralelo: el total permite a la interfaz
    // saber cuántas páginas hay.
    const [items, total] = await Promise.all([
      prismaClient.execution.findMany({
        where,
        select: CAMPOS_LISTA,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prismaClient.execution.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  // Resumen por estado, para mostrar los contadores encima de la tabla.
  async function summary(userId) {
    const filas = await prismaClient.execution.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    });

    return filas.reduce((acumulado, fila) => {
      acumulado[fila.status] = fila._count._all;
      return acumulado;
    }, {});
  }

  return { list, summary };
}

const executionService = createExecutionService();

module.exports = { ...executionService, createExecutionService, NotFoundError };
