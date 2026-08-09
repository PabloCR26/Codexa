// El registro de adaptadores debe coincidir con los proveedores que acepta la
// API. Cuando no coincidían, guardar la automatización funcionaba pero la
// ejecución fallaba con "Proveedor no soportado", y solo se notaba al dispararla.
const assert = require("node:assert/strict");
const test = require("node:test");
const { getAdapter, adapters } = require("../src/worker/adapters");
const { PROVIDERS } = require("../src/api/validators/automations");

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
