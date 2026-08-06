const crypto = require("node:crypto");
const express = require("express");
const { env } = require("../../config");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/requireAuth");
const connections = require("../services/connections");
const providers = require("../services/oauthProviders");

const router = express.Router();
const SUPPORTED_PROVIDERS = new Set(["github", "google"]);
const FLOW_TTL_MS = 10 * 60 * 1000;

function base64urlSha256(value) {
  return crypto.createHash("sha256").update(value).digest("base64url");
}

function callbackRedirect(provider, result, code) {
  const url = new URL("/connections", env.webUrl);
  url.searchParams.set(result, provider);
  if (code) url.searchParams.set("reason", code);
  return url.toString();
}

function validProvider(request, response, next) {
  if (!SUPPORTED_PROVIDERS.has(request.params.provider)) {
    return response.status(404).json({ error: "OAUTH_PROVIDER_NOT_SUPPORTED" });
  }
  next();
}

router.get(
  "/:provider/start",
  requireAuth,
  validProvider,
  asyncHandler(async (request, response) => {
    const state = crypto.randomBytes(32).toString("base64url");
    const codeVerifier = crypto.randomBytes(48).toString("base64url");
    request.session.oauthFlows ||= {};
    request.session.oauthFlows[request.params.provider] = {
      state,
      codeVerifier,
      createdAt: Date.now(),
      userId: request.userId,
    };
    const location = providers.authorizationUrl(request.params.provider, {
      state,
      codeChallenge: base64urlSha256(codeVerifier),
    });
    await new Promise((resolve, reject) => {
      request.session.save((error) => (error ? reject(error) : resolve()));
    });
    response.redirect(location);
  }),
);

router.get(
  "/:provider/callback",
  validProvider,
  asyncHandler(async (request, response) => {
    const provider = request.params.provider;
    const flow = request.session?.oauthFlows?.[provider];
    if (request.session?.oauthFlows) delete request.session.oauthFlows[provider];

    const receivedState = typeof request.query.state === "string" ? request.query.state : "";
    const expectedState = flow?.state || "";
    const validState = receivedState.length === expectedState.length &&
      receivedState.length > 0 &&
      crypto.timingSafeEqual(Buffer.from(receivedState), Buffer.from(expectedState));
    const validFlow = flow?.userId === request.session?.userId && Date.now() - flow?.createdAt <= FLOW_TTL_MS;
    if (!validState || !validFlow) {
      return response.redirect(callbackRedirect(provider, "error", "OAUTH_STATE_INVALID"));
    }
    if (request.query.error || typeof request.query.code !== "string") {
      return response.redirect(callbackRedirect(provider, "error", "OAUTH_AUTHORIZATION_DENIED"));
    }

    try {
      const tokens = await providers.exchangeCode(provider, request.query.code, flow.codeVerifier);
      const metadata = await providers.getAccount(provider, tokens.access_token);
      await connections.saveOAuthConnection(flow.userId, provider, tokens, metadata);
      return response.redirect(callbackRedirect(provider, "connected"));
    } catch (error) {
      console.error(`OAuth ${provider} falló:`, error.code || error.message);
      return response.redirect(callbackRedirect(provider, "error", error.code || "OAUTH_CALLBACK_FAILED"));
    }
  }),
);

module.exports = { oauthRouter: router };
