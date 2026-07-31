const IORedis = require("ioredis");
const { env } = require("../config");

function createRedisConnection() {
  return new IORedis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

module.exports = { createRedisConnection };
