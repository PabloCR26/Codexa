const crypto = require("node:crypto");
const { redisClient } = require("../../shared/redis");

const LIMIT = 5;
const WINDOW_SECONDS = 15 * 60;

function buildKey(request) {
  const ip = request.ip || request.socket?.remoteAddress || "unknown";
  const email = String(request.body?.email || "").trim().toLowerCase();
  const emailHash = crypto.createHash("sha256").update(email).digest("hex");
  return `ratelimit:login:${ip}:${emailHash}`;
}

// Antes de autenticar solo se consulta el contador. Incrementarlo aquí
// bloquearía también a quien inicia sesión correctamente varias veces.
async function loginRateLimit(request, response, next) {
  const key = buildKey(request);

  try {
    const attempts = Number((await redisClient.get(key)) || 0);
    if (attempts >= LIMIT) {
      const ttl = await redisClient.ttl(key);
      if (ttl > 0) response.set("Retry-After", String(ttl));
      return response.status(429).json({
        error: "TOO_MANY_LOGIN_ATTEMPTS",
        detail: "Demasiados intentos de login. Intenta de nuevo en 15 minutos.",
      });
    }

    request.loginRateLimitKey = key;
    return next();
  } catch (error) {
    console.error("Error en rate limiting de login:", error);
    return next();
  }
}

async function recordLoginFailure(request) {
  const key = request.loginRateLimitKey || buildKey(request);
  const attempts = await redisClient.incr(key);
  if (attempts === 1) await redisClient.expire(key, WINDOW_SECONDS);
}

async function clearLoginFailures(request) {
  const key = request.loginRateLimitKey || buildKey(request);
  await redisClient.del(key);
}

module.exports = { loginRateLimit, recordLoginFailure, clearLoginFailures };
