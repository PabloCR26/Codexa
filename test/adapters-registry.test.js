// Credenciales ficticias: deben definirse ANTES de cargar los módulos, porque
// la configuración lee process.env al importarse. Sin esto, los adaptadores
// fallan por falta de token y nunca llegan a validar sus parámetros.
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "token-de-prueba";

const assert = require("node:assert/strict");
const test = require("node:test");
const { getAdapter, adapters } = require("../src/worker/adapters");
const { PROVIDERS } = require("../src/api/validators/automations");

// El registro de adaptadores debe coincidir con los proveedores que acepta la
// API. Cuando no coincidían, guardar la automatización funcionaba pero la
// ejecución fallaba con "Proveedor no soportado", y solo se notaba al dispararla.
test("cada proveedor aceptado por la API tiene adaptador", () => {
  for (const provider of PROVIDERS) {
    assert.ok(
      adapters[provider],
      `Falta el adaptador de ${provider}. Las claves del registro deben ser las del enum Provider.`,
    );
  }
});

test("el registro no expone proveedores que la API rechazaría", () => {
  for (const clave of Object.keys(adapters)) {
    assert.ok(
      PROVIDERS.includes(clave),
      `El registro tiene "${clave}", que no está en los proveedores válidos: ${PROVIDERS.join(", ")}`,
    );
  }
});

test("las tres acciones del catálogo se resuelven", () => {
  assert.equal(typeof getAdapter("GOOGLE", "send_email"), "function");
  assert.equal(typeof getAdapter("GITHUB", "create_issue"), "function");
  assert.equal(typeof getAdapter("TELEGRAM", "send_message"), "function");
});

test("un proveedor o una acción desconocida lanzan error", () => {
  assert.throws(() => getAdapter("INVENTADO", "send_email"), /Proveedor no soportado/);
  assert.throws(() => getAdapter("GOOGLE", "accion_inexistente"), /Acción no soportada/);
});

// Los nombres de los campos del formulario deben ser los que lee el adaptador.
// Telegram guardaba "text" y el adaptador leía "message", así que toda acción
// creada desde la interfaz fallaba con MISSING_MESSAGE al ejecutarse.
//
// Los parámetros de cada caso son exactamente los que define el catálogo en
// web/src/JS/automationCatalog.js. Si alguien cambia un nombre allí sin ajustar
// el adaptador, esta prueba falla.
test("cada adaptador acepta los parámetros que produce el formulario", async () => {
  const casos = [
    { provider: "GOOGLE", accion: "send_email", params: { to: "a@b.c", subject: "s", body: "b" } },
    { provider: "GITHUB", accion: "create_issue", params: { owner: "o", repo: "r", title: "t", body: "b" } },
    { provider: "TELEGRAM", accion: "send_message", params: { chatId: "1", text: "hola" } },
  ];

  // Se simula la red: interesa la validación de parámetros, no llamar de verdad
  // a Gmail, GitHub o Telegram.
  const fetchOriginal = global.fetch;
  global.fetch = async () =>
    new Response(JSON.stringify({ ok: true, result: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  try {
    for (const { provider, accion, params } of casos) {
      const adapter = getAdapter(provider, accion);
      const error = await adapter({
        params,
        connection: { accessToken: "token-de-prueba" },
        context: {},
      }).then(
        () => null,
        (e) => e,
      );

      const codigo = String(error?.code || "");
      assert.ok(
        !codigo.startsWith("MISSING_"),
        `${provider}.${accion} no reconoció un parámetro del formulario: ${codigo}`,
      );
    }
  } finally {
    global.fetch = fetchOriginal;
  }
});
