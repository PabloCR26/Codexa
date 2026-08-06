// Express 4 no captura los rechazos de promesas en los handlers async:
// sin esto, un error asíncrono deja la petición colgada en vez de llegar
// al middleware central de errores.
function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

module.exports = { asyncHandler };
