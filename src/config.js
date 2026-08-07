const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const required = ["DATABASE_URL", "REDIS_URL", "SESSION_SECRET"];
const webUrl = process.env.WEB_URL || "http://localhost:5173";

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
    webUrl,
    sessionCookieSecure: new URL(webUrl).protocol === "https:",
    redisUrl: process.env.REDIS_URL,
    sessionSecret: process.env.SESSION_SECRET,
    tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      redirectUri: process.env.GITHUB_REDIRECT_URI,
      scopes: process.env.GITHUB_OAUTH_SCOPES || "public_repo",
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
    },
    // Token de Telegram para la acción send_message (opcional)
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    // Trabajos simultáneos del worker. Se mantiene bajo para respetar
    // los límites de tasa de las APIs de los proveedores.
    workerConcurrency: Number(process.env.WORKER_CONCURRENCY || 5),
  },
  validateEnvironment,
};
