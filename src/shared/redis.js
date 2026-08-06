const IORedis = require("ioredis");
const { env } = require("../config");

function createRedisConnection() {
  return new IORedis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

// Cliente Redis singleton compartido para toda la aplicación.
// Se usa en colas, rate limiting y caché.
const redisClient = createRedisConnection();

module.exports = { createRedisConnection, redisClient };
