const { Queue } = require("bullmq");
const { createRedisConnection } = require("./redis");

const EXECUTIONS_QUEUE = "executions";
const DEAD_LETTER_QUEUE = "executions-dlq";

const EXECUTIONS_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

function createExecutionsQueue() {
  return new Queue(EXECUTIONS_QUEUE, {
    connection: createRedisConnection(),
    defaultJobOptions: EXECUTIONS_JOB_OPTIONS,
  });
}

// Cola de mensajes fallidos: recibe los trabajos que agotaron sus reintentos.
// Se inspecciona manualmente; estos trabajos no se reintentan solos.
function createDeadLetterQueue() {
  return new Queue(DEAD_LETTER_QUEUE, {
    connection: createRedisConnection(),
    defaultJobOptions: { attempts: 1, removeOnComplete: false, removeOnFail: false },
  });
}

module.exports = {
  EXECUTIONS_QUEUE,
  DEAD_LETTER_QUEUE,
  EXECUTIONS_JOB_OPTIONS,
  createExecutionsQueue,
  createDeadLetterQueue,
};
