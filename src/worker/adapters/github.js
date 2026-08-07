// Adaptador para GitHub
// Crea issues en repositorios

// Errores permanentes: 4xx (excepto 429)
// Errores reintentables: 429 y 5xx
const PERMANENT_ERRORS = /^4[0-2]\d|^4[3-9]\d/;
const RETRYABLE_ERRORS = /^429|^5\d\d/;

class GitHubError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = "GitHubError";
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = RETRYABLE_ERRORS.test(String(statusCode));
    this.isPermanent = PERMANENT_ERRORS.test(String(statusCode));
  }
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
