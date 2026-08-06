// Exige una sesión válida y expone el identificador del usuario.
// La identidad se toma siempre de la sesión, nunca de un dato enviado
// por el cliente: es la base del aislamiento del espacio de trabajo.
function requireAuth(request, response, next) {
  if (!request.session || !request.session.userId) {
    return response.status(401).json({ error: "UNAUTHENTICATED" });
  }

  request.userId = request.session.userId;
  next();
}

module.exports = { requireAuth };
