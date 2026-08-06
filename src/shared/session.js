const { RedisStore } = require("connect-redis");
const { createClient } = require("redis");
const { env } = require("../config");

const sessionClient = createClient({ url: env.redisUrl });

sessionClient.on("error", (error) => {
  console.error("Error de Redis para sesiones:", error);
});

const sessionStore = new RedisStore({
  client: sessionClient,
  prefix: "flowhub:session:",
});

async function connectSessionStore() {
  if (!sessionClient.isOpen) {
    await sessionClient.connect();
  }
}

async function closeSessionStore() {
  if (sessionClient.isOpen) {
    await sessionClient.quit();
  }
}

module.exports = { sessionStore, connectSessionStore, closeSessionStore };
