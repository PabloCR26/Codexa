// Adaptador para GitHub
// Crea issues en repositorios

// Clasificación de errores, en números y no con expresiones regulares: la
// versión anterior usaba /^4[0-2]\d/ para "permanente", que también capturaba
// el 429 y hacía que un límite de tasa no se reintentara nunca.
//
//   permanente   -> 4xx menos 429: repetirlo daría el mismo resultado
//   reintentable -> 429 y 5xx: el problema es temporal
function esPermanente(statusCode) {
  return statusCode >= 400 && statusCode < 500 && statusCode !== 429;
}

function esReintentable(statusCode) {
  return statusCode === 429 || statusCode >= 500;
}

class GitHubError extends Error {
  constructor(message, code, statusCode, retryAfter) {
    super(message);
    this.name = "GitHubError";
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = esReintentable(statusCode);
    this.isPermanent = esPermanente(statusCode);
    // Segundos que pide esperar el proveedor antes de reintentar.
    this.retryAfter = retryAfter;
  }
}

// GitHub responde con Retry-After, o con X-RateLimit-Reset como marca de
// tiempo absoluta cuando se agota la cuota horaria.
function esperaSugerida(response) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter;

  const reset = Number(response.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) {
    return Math.max(1, Math.ceil(reset - Date.now() / 1000));
  }

  return undefined;
}

async function createIssue({ params, connection, context }) {
  if (!connection?.accessToken) {
    throw new GitHubError("Token de GitHub no disponible", "MISSING_TOKEN", 401);
  }

  const { owner, repo, title, body, labels = [] } = params;

  if (!owner || !repo) {
    throw new GitHubError(
      "owner y repo son requeridos",
      "MISSING_PARAMS",
      400,
    );
  }

  if (!title) {
    throw new GitHubError("title es requerido", "MISSING_TITLE", 400);
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/issues`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `token ${connection.accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "FlowHub",
      },
      body: JSON.stringify({
        title,
        body: body || "",
        labels: Array.isArray(labels) ? labels : [],
      }),
      timeout: 10000,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new GitHubError(
        error.message || "Error en GitHub",
        error.errors?.[0]?.code || "UNKNOWN_ERROR",
        response.status,
        esperaSugerida(response),
      );
    }

    const result = await response.json();
    return {
      success: true,
      issueNumber: result.number,
      issueUrl: result.html_url,
      rawResponse: result,
    };
  } catch (error) {
    if (error instanceof GitHubError) throw error;
    throw new GitHubError(error.message, "NETWORK_ERROR", 0);
  }
}

module.exports = {
  create_issue: createIssue,
  GitHubError,
};
