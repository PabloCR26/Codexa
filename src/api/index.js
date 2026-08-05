const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
const { env, validateEnvironment } = require("../config");
const { placeholderRouter } = require("./routes/placeholder");
const { authRouter } = require("./routes/auth");

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

app.use("/api/auth", authRouter);

// Módulos aún no implementados: responden 501 hasta que se desarrolle su fase.
for (const resource of [
  "automations",
  "webhooks",
  "oauth",
  "connections",
  "executions",
  "2fa",
]) {
  app.use(`/api/${resource}`, placeholderRouter(resource));
}

app.use((error, _request, response, _next) => {
  // Los servicios lanzan errores con código y estado propios (por ejemplo,
  // credenciales inválidas); el resto se trata como fallo interno.
  if (error && error.status) {
    return response.status(error.status).json({ error: error.code });
  }

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
