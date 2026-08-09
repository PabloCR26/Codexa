// Tarea 57: interpolacion de plantillas, con campos anidados e inexistentes.
const assert = require("node:assert/strict");
const test = require("node:test");
const { interpolateValue, runAutomation } = require("../src/worker/engine");

const datos = {
  title: "Fallo en produccion",
  repository: "utn/flowhub",
  autor: { login: "eliam", perfil: { url: "https://github.com/eliam" } },
  comentarios: 3,
};
const contexto = { ...datos, trigger: datos };

test("resuelve la forma trigger.campo que usan el enunciado y la interfaz", () => {
  assert.equal(interpolateValue("{{trigger.title}}", contexto), "Fallo en produccion");
  assert.equal(
    interpolateValue("Nuevo issue en {{trigger.repository}}", contexto),
    "Nuevo issue en utn/flowhub",
  );
});

test("tambien resuelve el campo sin el prefijo trigger", () => {
  assert.equal(interpolateValue("{{title}}", contexto), "Fallo en produccion");
});

test("resuelve campos anidados a cualquier profundidad", () => {
  assert.equal(interpolateValue("{{trigger.autor.login}}", contexto), "eliam");
  assert.equal(
    interpolateValue("{{trigger.autor.perfil.url}}", contexto),
    "https://github.com/eliam",
  );
});

test("un campo inexistente se reemplaza por vacio y no rompe el texto", () => {
  assert.equal(interpolateValue("{{trigger.noExiste}}", contexto), "");
  assert.equal(interpolateValue("Hola {{trigger.noExiste}}!", contexto), "Hola !");
  // Atravesar algo que no es objeto tampoco debe lanzar error.
  assert.equal(interpolateValue("{{trigger.title.interno.otro}}", contexto), "");
});

test("admite varias plantillas en el mismo texto y tolera espacios", () => {
  assert.equal(
    interpolateValue("{{ trigger.autor.login }} abrio {{trigger.title}}", contexto),
    "eliam abrio Fallo en produccion",
  );
});

test("los numeros se convierten a texto al interpolar", () => {
  assert.equal(interpolateValue("Comentarios: {{trigger.comentarios}}", contexto), "Comentarios: 3");
});

test("interpola dentro de objetos y arreglos, sin tocar los no textos", () => {
  const parametros = {
    chatId: "123",
    text: "Issue: {{trigger.title}}",
    etiquetas: ["{{trigger.autor.login}}", "fijo"],
    reintentar: true,
    intentos: 2,
  };

  assert.deepEqual(interpolateValue(parametros, contexto), {
    chatId: "123",
    text: "Issue: Fallo en produccion",
    etiquetas: ["eliam", "fijo"],
    reintentar: true,
    intentos: 2,
  });
});

test("un texto sin plantillas queda igual", () => {
  assert.equal(interpolateValue("Mensaje fijo", contexto), "Mensaje fijo");
});

// Comprobacion de extremo a extremo: los parametros que recibe el adaptador
// deben llegar ya resueltos.
test("la accion recibe los parametros con las plantillas resueltas", async () => {
  const automation = {
    id: "auto-1",
    userId: "user-1",
    enabled: true,
    triggerType: "GITHUB_WEBHOOK",
    conditions: [],
    actions: [
      {
        provider: "TELEGRAM",
        actionType: "send_message",
        params: { chatId: "1", text: "{{trigger.autor.login}} abrio: {{trigger.title}}" },
      },
    ],
  };

  const executions = [];
  const prismaClient = {
    automation: { findUnique: async () => automation },
    execution: {
      findUnique: async () => null,
      create: async ({ data }) => {
        const fila = { id: "exec-1", ...data };
        executions.push(fila);
        return fila;
      },
      update: async ({ data }) => {
        Object.assign(executions[0], data);
        return executions[0];
      },
    },
    connection: { findFirst: async () => null },
  };

  // skipExternalCalls evita la llamada real al proveedor, pero los parametros
  // ya vienen resueltos y quedan registrados en la salida.
  const resultado = await runAutomation(
    { automationId: "auto-1", eventId: "evt-1", triggerData: datos },
    { prismaClient, adapterContext: { skipExternalCalls: true } },
  );

  assert.equal(resultado.status, "SUCCEEDED");
  assert.equal(
    resultado.actionResults[0].params.text,
    "eliam abrio: Fallo en produccion",
  );
});
