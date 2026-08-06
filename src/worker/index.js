// Worker (consumidor): proceso independiente de la API.
// Toma trabajos de la cola `executions` y ejecuta la cadena de acciones.
// Se arranca y despliega por separado; solo se comunica con la API vía Redis.
const { Worker } = require("bullmq");
const { validateEnvironment, env } = require("../config");
const { createRedisConnection } = require("../shared/redis");
const { EXECUTIONS_QUEUE, createDeadLetterQueue } = require("../shared/queue");
const { runAutomation } = require("./engine");

validateEnvironment();

const deadLetterQueue = createDeadLetterQueue();

const worker = new Worker(
  EXECUTIONS_QUEUE,
  async (job) => {
    console.log(`Procesando job ${job.id} (intento ${job.attemptsMade + 1})`);
    return runAutomation(job.data);
  },
  {
    connection: createRedisConnection(),
    concurrency: env.workerConcurrency,
  },
);

worker.on("completed", (job, result) => {
  console.log(`Job ${job.id} completado`, result);
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

async function shutdown(signal) {
  console.log(`${signal}: cerrando worker`);
  await worker.close();
  await deadLetterQueue.close();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
