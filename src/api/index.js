const crypto = require("node:crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
const { env, validateEnvironment } = require("../config");
const {
  closeSessionStore,
  connectSessionStore,
  sessionStore,
} = require("../shared/session");
const { authRouter } = require("./routes/auth");
const { automationsRouter } = require("./routes/automations");
const { connectionsRouter } = require("./routes/connections");
const { executionsRouter } = require("./routes/executions");
const { oauthRouter } = require("./routes/oauth");
const { placeholderRouter } = require("./routes/placeholder");
const { twoFactorRouter } = require("./routes/two-factor");

validateEnvironment();

const app = express();

// En producción nginx es el único proxy delante de Express. Esto permite que
// request.ip use X-Forwarded-For sin confiar en encabezados enviados directamente.
if (env.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(cors({ origin: env.webUrl, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(
  session({
    name: "flowhub.sid",
    store: sessionStore,
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: env.nodeEnv === "production" ? "none" : "lax",
      secure: env.nodeEnv === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

function ensureCsrfToken(request, response, next) {
  // Garantizar que la sesión existe; si no, pasar al siguiente middleware
  // para que express-session la cree.
  if (!request.session) {
    return next();
  }

  // Generar el token CSRF para esta sesión si aún no existe.
  if (!request.session.csrfToken) {
    request.session.csrfToken = crypto.randomBytes(24).toString("hex");
  }

  // Las peticiones de lectura no necesitan validación de CSRF.
  const isSafeMethod = ["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (isSafeMethod) {
    return next();
  }

  // Validar que el token enviado coincida con el de la sesión.
  const providedToken = request.get("x-csrf-token") || "";
  const expectedToken = request.session.csrfToken;
  const providedBuffer = Buffer.from(providedToken);
  const expectedBuffer = Buffer.from(expectedToken);
  const validToken =
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer);

  if (!validToken) {
    return response.status(403).json({ error: "CSRF_TOKEN_INVALID" });
  }

  return next();
}

app.use(ensureCsrfToken);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "flowhub-api" });
});

app.get("/api/csrf-token", (request, response) => {
  if (!request.session) {
    return response.status(500).json({ error: "SESSION_NOT_AVAILABLE" });
  }

  if (!request.session.csrfToken) {
    request.session.csrfToken = crypto.randomBytes(24).toString("hex");
  }

  response.json({ csrfToken: request.session.csrfToken });
});

app.use("/api/auth", authRouter);
app.use("/api/automations", automationsRouter);

// El módulo de webhooks todavía no está implementado.
for (const resource of ["webhooks"]) {
  app.use(`/api/${resource}`, placeholderRouter(resource));
}

app.use("/api/oauth", oauthRouter);
app.use("/api/connections", connectionsRouter);
app.use("/api/executions", executionsRouter);
app.use("/api/2fa", twoFactorRouter);

app.use((error, _request, response, _next) => {
  // Los servicios lanzan errores con código y estado propios (por ejemplo,
  // credenciales inválidas); el resto se trata como fallo interno.
  if (error && error.status) {
    return response.status(error.status).json({ error: error.code });
  }

  console.error(error);
  response.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
});

let server;

async function startServer() {
  await connectSessionStore();
  server = app.listen(env.port, () => {
    console.log(`FlowHub API escuchando en http://localhost:${env.port}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal}: cerrando API`);
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await closeSessionStore();
  process.exit(0);
}

startServer().catch((error) => {
  console.error("No se pudo iniciar la API:", error);
  process.exit(1);
});

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
