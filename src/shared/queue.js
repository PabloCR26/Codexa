const { Queue } = require("bullmq");
const { createRedisConnection } = require("./redis");

const EXECUTIONS_QUEUE = "executions";

function createExecutionsQueue() {
  return new Queue(EXECUTIONS_QUEUE, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });
}

module.exports = { EXECUTIONS_QUEUE, createExecutionsQueue };
