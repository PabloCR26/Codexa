const { redisClient } = require("../../shared/redis");

// Limitar intentos de login a 5 intentos fallidos por IP en 15 minutos.
// Implementación manual con Redis para confiabilidad.
async function loginRateLimit(request, response, next) {
  const ip = request.ip || request.connection.remoteAddress || "unknown";
  const key = `ratelimit:login:${ip}`;
  const limit = 5;
  const windowMs = 15 * 60; // 15 minutos en segundos

  try {
    const attempts = await redisClient.incr(key);
    
    // Si es el primer intento, establecer la expiración
    if (attempts === 1) {
      await redisClient.expire(key, windowMs);
    }

    // Si se superó el límite, responder con 429
    if (attempts > limit) {
      return response.status(429).json({
        error: "TOO_MANY_LOGIN_ATTEMPTS",
        detail: "Demasiados intentos de login. Intenta de nuevo en 15 minutos.",
      });
    }

    // Guardar en request para que el servicio sepa cuántos intentos hubo
    request.loginAttempts = attempts;
    next();
  } catch (error) {
    console.error("Error en rate limiting de login:", error);
    // En caso de error de Redis, permitir el intento pero loguear
    next();
  }
}

module.exports = { loginRateLimit };
