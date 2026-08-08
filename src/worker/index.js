// Worker (consumidor): proceso independiente de la API.
// Toma trabajos de la cola `executions` y ejecuta la cadena de acciones.
// Se arranca y despliega por separado; solo se comunica con la API vía Redis.
const { Worker } = require("bullmq");
const { validateEnvironment, env } = require("../config");
const { createRedisConnection } = require("../shared/redis");
const { EXECUTIONS_QUEUE, createDeadLetterQueue, createExecutionsQueue } = require("../shared/queue");
const { runAutomation } = require("./engine");
const { syncCronAutomations } = require("./scheduler");

validateEnvironment();

const deadLetterQueue = createDeadLetterQueue();
const schedulingQueue = createExecutionsQueue();

const worker = new Worker(
  EXECUTIONS_QUEUE,
  async (job) => {
    console.log(`Procesando job ${job.id} (intento ${job.attemptsMade + 1})`);

    // Los disparos programados no traen eventId: cada corrida es un evento
    // nuevo. Se usa el identificador del job, que BullMQ genera con la marca
    // de tiempo de la corrida y conserva entre reintentos: así un reintento
    // sigue siendo el mismo evento y el motor no duplica las acciones.
    const datos = job.data?.eventId ? job.data : { ...job.data, eventId: job.id };

    return runAutomation(datos);
  },
  {
    connection: createRedisConnection(),
    concurrency: env.workerConcurrency,
  },
);

worker.on("completed", (job, result) => {
  console.log(`Job ${job.id} completado`, JSON.stringify(result));
});

worker.on("failed", async (job, error) => {
  if (!job) {
    console.error("Job fallido sin referencia", error);
    return;
  }

  const intentos = job.opts.attempts || 1;
  console.error(`Job ${job.id} fallo en el intento ${job.attemptsMade}: ${error.message}`);

  // Solo cuando se agotan los reintentos el trabajo pasa a la cola de fallidos.
  if (job.attemptsMade >= intentos) {
    console.error(`Job ${job.id} agoto los reintentos, se envia a la DLQ`);
    await deadLetterQueue.add("failed", {
      originalJobId: job.id,
      data: job.data,
      error: error.message,
      failedAt: new Date().toISOString(),
    });
  }
});

worker.on("error", (error) => {
  console.error("Error del worker", error);
});

console.log(`Worker de FlowHub escuchando la cola ${EXECUTIONS_QUEUE}`);

syncCronAutomations(schedulingQueue).catch((error) => {
  console.error("No se pudieron sincronizar los jobs cron", error);
});

// Reconciliación periódica: es la que aplica los cambios del CRUD sobre las
// programaciones (altas, cambios de expresión y bajas por desactivar o borrar).
// Con 30 segundos, un cambio hecho desde la interfaz se refleja antes del
// siguiente minuto, que es la granularidad mínima de una expresión cron.
setInterval(() => {
  syncCronAutomations(schedulingQueue).catch((error) => {
    console.error("No se pudieron sincronizar los jobs cron", error);
  });
}, 30_000);

async function shutdown(signal) {
  console.log(`${signal}: cerrando worker`);
  await worker.close();
  await deadLetterQueue.close();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
