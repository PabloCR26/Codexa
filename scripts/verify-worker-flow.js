const { validateEnvironment } = require("../src/config");
const { createExecutionsQueue } = require("../src/shared/queue");

async function main() {
  validateEnvironment();
  const queue = createExecutionsQueue();
  const job = await queue.add("verify-flow", {
    automationId: "demo-automation",
    eventId: `verify-${Date.now()}`,
    triggerData: { source: "verification-script", message: "Flow OK" },
    version: 1,
  });
  console.log(`Job verificado encolado con id ${job.id}`);
  await queue.close();
}

main().catch((error) => {
  console.error("No se pudo verificar el flujo", error);
  process.exitCode = 1;
});
