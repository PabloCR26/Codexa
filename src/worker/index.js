// Worker (consumidor): proceso independiente de la API.
// Toma trabajos de la cola `executions` y ejecuta la cadena de acciones.
// Se arranca y despliega por separado; solo se comunica con la API vía Redis.
const { Worker, UnrecoverableError, DelayedError } = require("bullmq");
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
  async (job, token) => {
    console.log(`Procesando job ${job.id} (intento ${job.attemptsMade + 1})`);

    // Los disparos programados no traen eventId: cada corrida es un evento
    // nuevo. Se usa el identificador del job, que BullMQ genera con la marca
    // de tiempo de la corrida y conserva entre reintentos: así un reintento
    // sigue siendo el mismo evento y el motor no duplica las acciones.
    const datos = job.data?.eventId ? job.data : { ...job.data, eventId: job.id };

    try {
      return await runAutomation(datos);
    } catch (error) {
      // Error permanente (4xx salvo 429): reintentarlo daría el mismo
      // resultado y solo gastaría cuota del proveedor. Se manda directo a la
      // cola de fallidos sin agotar los intentos.
      if (error.isPermanent) {
        console.error(`Job ${job.id}: error permanente (${error.code}), no se reintenta`);
        throw new UnrecoverableError(`${error.code || "PERMANENT_ERROR"}: ${error.message}`);
      }

      // Límite de tasa: el proveedor dice cuánto esperar. Se respeta ese valor
      // en lugar del backoff propio, que podría reintentar antes de tiempo y
      // recibir otro 429.
      const espera = Number(error.retryAfter);
      if (Number.isFinite(espera) && espera > 0) {
        console.warn(`Job ${job.id}: límite de tasa, se reintenta en ${espera}s`);
        await job.moveToDelayed(Date.now() + espera * 1000, token);
        throw new DelayedError();
      }

      // Fallo transitorio (5xx, red): se propaga para que BullMQ reintente
      // aplicando el retroceso exponencial configurado en la cola.
      throw error;
    }
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
  const esPermanente = error.name === "UnrecoverableError";
  const agotoReintentos = job.attemptsMade >= intentos;

  console.error(`Job ${job.id} fallo en el intento ${job.attemptsMade}: ${error.message}`);

  // Un trabajo llega a la cola de fallidos por dos caminos: agotó sus
  // reintentos, o falló con un error permanente que no tiene sentido repetir.
  // Sin contemplar el segundo caso, los errores permanentes se perderían:
  // BullMQ los descarta de inmediato, sin llegar al tope de intentos.
  if (agotoReintentos || esPermanente) {
    const motivo = esPermanente ? "error permanente" : "agoto los reintentos";
    console.error(`Job ${job.id} ${motivo}, se envia a la DLQ`);
    await deadLetterQueue.add("failed", {
      originalJobId: job.id,
      data: job.data,
      error: error.message,
      permanente: esPermanente,
      intentos: job.attemptsMade,
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
