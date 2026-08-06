const { env } = require("../../config");

const GITHUB_API_VERSION = "2022-11-28";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

class OAuthError extends Error {
  constructor(code, status = 502) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function providerConfig(provider) {
  const config = env[provider];
  if (!config?.clientId || !config.clientSecret || !config.redirectUri) {
    throw new OAuthError(`${provider.toUpperCase()}_OAUTH_NOT_CONFIGURED`, 503);
  }
  return config;
}

async function readJson(response, code) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new OAuthError(code);
    error.providerMessage = body.error_description || body.message || body.error;
    throw error;
  }
  return body;
}

function authorizationUrl(provider, { state, codeChallenge }) {
  const config = providerConfig(provider);
  if (provider === "github") {
    const url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    return url.toString();
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return url.toString();
}

async function exchangeCode(provider, code, codeVerifier) {
  const config = providerConfig(provider);
  const endpoint = provider === "github"
    ? "https://github.com/login/oauth/access_token"
    : "https://oauth2.googleapis.com/token";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
      ...(provider === "google" ? { grant_type: "authorization_code" } : {}),
    }),
  });
  const tokens = await readJson(response, `${provider.toUpperCase()}_TOKEN_EXCHANGE_FAILED`);
  if (!tokens.access_token) throw new OAuthError(`${provider.toUpperCase()}_ACCESS_TOKEN_MISSING`);
  return tokens;
}

async function getAccount(provider, accessToken) {
  const endpoint = provider === "github"
    ? "https://api.github.com/user"
    : "https://gmail.googleapis.com/gmail/v1/users/me/profile";
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };
  if (provider === "github") {
    headers["X-GitHub-Api-Version"] = GITHUB_API_VERSION;
    headers["User-Agent"] = "FlowHub";
  }
  const account = await readJson(await fetch(endpoint, { headers }), `${provider.toUpperCase()}_PROFILE_FAILED`);
  return provider === "github"
    ? { accountId: String(account.id), login: account.login, avatarUrl: account.avatar_url }
    : { email: account.emailAddress };
}

async function refreshGoogleToken(refreshToken) {
  const config = providerConfig("google");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokens = await readJson(response, "GOOGLE_TOKEN_REFRESH_FAILED");
  if (!tokens.access_token || !Number.isFinite(Number(tokens.expires_in))) {
    throw new OAuthError("GOOGLE_REFRESH_RESPONSE_INVALID");
  }
  return tokens;
}

async function revokeToken(provider, accessToken, refreshToken) {
  if (provider === "google") {
    const token = refreshToken || accessToken;
    const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!response.ok && response.status !== 400) throw new OAuthError("GOOGLE_TOKEN_REVOCATION_FAILED");
    return;
  }

  const config = providerConfig("github");
  const response = await fetch(`https://api.github.com/applications/${encodeURIComponent(config.clientId)}/grant`, {
    method: "DELETE",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": "FlowHub",
    },
    body: JSON.stringify({ access_token: accessToken }),
  });
  if (!response.ok && response.status !== 404) throw new OAuthError("GITHUB_TOKEN_REVOCATION_FAILED");
}

module.exports = { OAuthError, authorizationUrl, exchangeCode, getAccount, refreshGoogleToken, revokeToken };
