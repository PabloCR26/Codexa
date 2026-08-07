const { prisma } = require("../shared/prisma");

async function pollGmailAutomation(automation) {
  if (automation.triggerType !== "GMAIL_POLL") {
    return { skipped: true, reason: "not_gmail_poll" };
  }

  const state = await prisma.triggerState.findUnique({ where: { automationId: automation.id } });
  const cursor = state?.cursor || null;
  const lastPolledAt = state?.lastPolledAt || null;

  const triggerData = {
    cursor,
    lastPolledAt,
    automationId: automation.id,
    messageCount: 0,
  };

  await prisma.triggerState.upsert({
    where: { automationId: automation.id },
    create: {
      automationId: automation.id,
      cursor,
      state: { lastPolledAt: new Date().toISOString() },
      lastPolledAt: new Date(),
    },
    update: {
      cursor,
      state: { lastPolledAt: new Date().toISOString() },
      lastPolledAt: new Date(),
    },
  });

  return { skipped: true, reason: "gmail_poll_stub", triggerData };
}

module.exports = { pollGmailAutomation };