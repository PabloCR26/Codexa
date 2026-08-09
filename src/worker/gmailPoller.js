// ESQUELETO — el sondeo de Gmail NO está implementado (tarea 51 de TAREAS.md).
//
// Este archivo administra el cursor en TriggerState, pero nunca consulta la API
// de Gmail: siempre devuelve "gmail_poll_stub" y ninguna automatización de tipo
// GMAIL_POLL llega a dispararse.
//
// El enunciado ya está cubierto con los otros dos disparadores: el webhook de
// GitHub (basado en eventos) y el cron (basado en tiempo). Este sería un tercero.
//
// Para completarlo haría falta:
//   1. obtener un token vigente con shared/oauthTokens.getValidAccessToken
//   2. llamar a users.history.list usando el historyId guardado como cursor
//   3. armar un triggerData por cada correo nuevo y encolarlo
//   4. guardar el historyId más reciente para no reprocesar
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