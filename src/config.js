const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const required = ["DATABASE_URL", "REDIS_URL", "SESSION_SECRET"];

function validateEnvironment() {
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(", ")}`);
  }
}

module.exports = {
  env: {
    nodeEnv: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT || 4000),
    webUrl: process.env.WEB_URL || "http://localhost:5173",
    redisUrl: process.env.REDIS_URL,
    sessionSecret: process.env.SESSION_SECRET,
    // Trabajos simultáneos del worker. Se mantiene bajo para respetar
    // los límites de tasa de las APIs de los proveedores.
    workerConcurrency: Number(process.env.WORKER_CONCURRENCY || 5),
  },
  validateEnvironment,
};
