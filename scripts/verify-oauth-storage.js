const { prisma } = require("../src/shared/prisma");

async function main() {
  const connections = await prisma.connection.findMany({
    where: { provider: { in: ["GOOGLE", "GITHUB"] } },
    select: {
      provider: true,
      accessTokenEncrypted: true,
      refreshTokenEncrypted: true,
      expiresAt: true,
    },
    orderBy: { provider: "asc" },
  });

  if (connections.length === 0) {
    console.log("No hay conexiones OAuth guardadas todavía.");
    return;
  }

  console.table(connections.map((connection) => ({
    provider: connection.provider,
    accessTokenCifrado: connection.accessTokenEncrypted?.startsWith("v1:") || false,
    refreshTokenCifrado: connection.refreshTokenEncrypted?.startsWith("v1:") || false,
    tieneExpiracion: Boolean(connection.expiresAt),
  })));
}

main()
  .catch((error) => {
    console.error("No se pudo verificar el almacenamiento OAuth:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
