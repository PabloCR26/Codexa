const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
const { env, validateEnvironment } = require("../config");
const { connectionsRouter } = require("./routes/connections");
const { executionsRouter } = require("./routes/executions");
const { oauthRouter } = require("./routes/oauth");
const { placeholderRouter } = require("./routes/placeholder");
const { twoFactorRouter } = require("./routes/two-factor");

validateEnvironment();

const app = express();

app.use(helmet());
app.use(cors({ origin: env.webUrl, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(
  session({
    name: "flowhub.sid",
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.nodeEnv === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "flowhub-api" });
});

for (const resource of ["auth", "automations", "webhooks"]) {
  app.use(`/api/${resource}`, placeholderRouter(resource));
}

app.use("/api/oauth", oauthRouter);
app.use("/api/connections", connectionsRouter);
app.use("/api/executions", executionsRouter);
app.use("/api/2fa", twoFactorRouter);

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
});

const server = app.listen(env.port, () => {
  console.log(`FlowHub API escuchando en http://localhost:${env.port}`);
});

function shutdown(signal) {
  console.log(`${signal}: cerrando API`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
