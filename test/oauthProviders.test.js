const assert = require("node:assert/strict");
const test = require("node:test");

process.env.GITHUB_CLIENT_ID = "github-client";
process.env.GITHUB_CLIENT_SECRET = "github-secret";
process.env.GITHUB_REDIRECT_URI = "http://localhost:4000/api/oauth/github/callback";
process.env.GITHUB_OAUTH_SCOPES = "public_repo";
process.env.GOOGLE_CLIENT_ID = "google-client";
process.env.GOOGLE_CLIENT_SECRET = "google-secret";
process.env.GOOGLE_REDIRECT_URI = "http://localhost:4000/api/oauth/google/callback";

const { authorizationUrl } = require("../src/api/services/oauthProviders");

test("GitHub recibe state, PKCE y el scope mínimo configurado", () => {
  const url = new URL(authorizationUrl("github", { state: "state", codeChallenge: "challenge" }));
  assert.equal(url.origin, "https://github.com");
  assert.equal(url.searchParams.get("state"), "state");
  assert.equal(url.searchParams.get("code_challenge"), "challenge");
  assert.equal(url.searchParams.get("scope"), "public_repo");
});

test("Google solicita acceso offline, consentimiento y Gmail modify", () => {
  const url = new URL(authorizationUrl("google", { state: "state", codeChallenge: "challenge" }));
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("state"), "state");
  assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/gmail.modify");
});
