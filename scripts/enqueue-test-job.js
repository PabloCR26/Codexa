const { validateEnvironment } = require("../src/config");
const { createExecutionsQueue } = require("../src/shared/queue");

async function main() {
  validateEnvironment();

  const queue = createExecutionsQueue();
  const automationId = process.argv[2] || "automation-1";
  const eventId = process.argv[3] || `event-${Date.now()}`;

  const job = await queue.add("run-automation", {
    automationId,
    eventId,
    triggerData: {
      repository: "flowhub/test-repo",
      issueTitle: "Demo desde script",
      message: "Hola desde el worker",
    },
    version: 1,
  });

  console.log(`Job encolado: ${job.id}`);
  await queue.close();
}

main().catch((error) => {
  console.error("No se pudo encolar el job", error);
  process.exitCode = 1;
});
