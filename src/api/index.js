const crypto = require("node:crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
const { env, validateEnvironment } = require("../config");
const { placeholderRouter } = require("./routes/placeholder");
const { authRouter } = require("./routes/auth");
const { automationsRouter } = require("./routes/automations");

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
  const providedToken = request.get("x-csrf-token");
  if (!providedToken || providedToken !== request.session.csrfToken) {
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

// Módulos aún no implementados: responden 501 hasta que se desarrolle su fase.
for (const resource of [
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
