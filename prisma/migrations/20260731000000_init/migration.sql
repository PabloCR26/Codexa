-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('GOOGLE', 'GITHUB', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('GITHUB_WEBHOOK', 'GMAIL_POLL', 'CRON');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" "TriggerType" NOT NULL,
    "triggerConfig" JSONB NOT NULL,
    "conditions" JSONB,
    "actions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriggerState" (
    "id" TEXT NOT NULL,
    "cursor" TEXT,
    "state" JSONB,
    "lastPolledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "automationId" TEXT NOT NULL,
    CONSTRAINT "TriggerState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "eventId" TEXT,
    "triggerData" JSONB NOT NULL,
    "output" JSONB,
    "error" JSONB,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "automationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Connection_userId_provider_key" ON "Connection"("userId", "provider");
CREATE INDEX "Connection_userId_idx" ON "Connection"("userId");
CREATE INDEX "Automation_userId_idx" ON "Automation"("userId");
CREATE INDEX "Automation_enabled_triggerType_idx" ON "Automation"("enabled", "triggerType");
CREATE UNIQUE INDEX "TriggerState_automationId_key" ON "TriggerState"("automationId");
CREATE UNIQUE INDEX "Execution_automationId_eventId_key" ON "Execution"("automationId", "eventId");
CREATE INDEX "Execution_userId_createdAt_idx" ON "Execution"("userId", "createdAt");
CREATE INDEX "Execution_automationId_idx" ON "Execution"("automationId");
CREATE INDEX "Execution_status_idx" ON "Execution"("status");

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TriggerState" ADD CONSTRAINT "TriggerState_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
