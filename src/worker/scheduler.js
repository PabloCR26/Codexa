const { prisma } = require("../shared/prisma");
const { createExecutionsQueue } = require("../shared/queue");

function buildCronJobName(automationId) {
  return `cron:${automationId}`;
}

async function syncCronAutomations(queue = createExecutionsQueue()) {
  const automations = await prisma.automation.findMany({
    where: {
      enabled: true,
      triggerType: "CRON",
    },
  });

  const jobs = await queue.getJobs(["active", "delayed", "wait", "repeatable"]);
  const existingNames = new Set(jobs.map((job) => job.name));

  for (const automation of automations) {
    const name = buildCronJobName(automation.id);
    if (existingNames.has(name)) continue;

    await queue.add(
      name,
      {
        automationId: automation.id,
        eventId: `cron-${Date.now()}`,
        triggerData: {
          expression: automation.triggerConfig?.expression || "",
          automationName: automation.name,
        },
        version: 1,
      },
      {
        repeat: { pattern: automation.triggerConfig?.expression || "0 * * * *" },
        jobId: name,
      },
    );
  }
}

module.exports = { syncCronAutomations, buildCronJobName };