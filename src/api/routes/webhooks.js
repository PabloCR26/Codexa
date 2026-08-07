const express = require("express");
const crypto = require("node:crypto");
const { asyncHandler } = require("../middleware/asyncHandler");
const { createExecutionsQueue } = require("../../shared/queue");
const { prisma } = require("../../shared/prisma");

const router = express.Router();

function verifyGitHubSignature(payload, signature, secret) {
  if (!secret) return true;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return signature === `sha256=${expected}`;
}

router.post(
  "/github",
  asyncHandler(async (request, response) => {
    const rawPayload = request.rawBody ? request.rawBody.toString("utf8") : JSON.stringify(request.body || {});
    const parsedBody = typeof request.body === "object" && request.body !== null ? request.body : JSON.parse(rawPayload);
    const signature = request.get("x-hub-signature-256") || "";
    const secret = process.env.GITHUB_WEBHOOK_SECRET || "";

    if (!verifyGitHubSignature(rawPayload, signature, secret)) {
      return response.status(401).json({ error: "WEBHOOK_SIGNATURE_INVALID" });
    }

    const automation = await prisma.automation.findFirst({
      where: {
        enabled: true,
        triggerType: "GITHUB_WEBHOOK",
      },
    });

    if (!automation) {
      return response.status202.json({ accepted: true, reason: "no_automation_registered" });
    }

    const queue = createExecutionsQueue();
    await queue.add("run-automation", {
      automationId: automation.id,
      eventId: `github-${Date.now()}`,
      triggerData: {
        repository: parsedBody?.repository?.full_name || "unknown",
        action: parsedBody?.action || "unknown",
        payload: parsedBody,
      },
      version: 1,
    });
    await queue.close();

    response.status(202).json({ accepted: true, queued: true });
  }),
);

module.exports = { webhooksRouter: router };