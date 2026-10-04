import { test } from "node:test";
import assert from "node:assert/strict";
import { accesoPanel, esGerencia, rutaPorRol } from "../src/lib/roles.ts";
import { observeAuth } from "../src/lib/auth-observer.ts";
test("rutas administrativas deniegan cliente/perfil ausente y requieren hotel para personal", () => {
  for (const perfil of [
    null,
    { rol: "cliente", hotel_id: null },
    { rol: "gerente", hotel_id: null },
    { rol: "recepcionista", hotel_id: null },
  ]) {
    assert.equal(accesoPanel(perfil, "gerente"), false);
    assert.equal(accesoPanel(perfil, "recepcionista"), false);
  }
  assert.equal(accesoPanel({ rol: "gerente", hotel_id: "santiago" }, "gerente"), true);
  assert.equal(accesoPanel({ rol: "recepcionista", hotel_id: "santiago" }, "gerente"), false);
  assert.equal(accesoPanel({ rol: "recepcionista", hotel_id: "santiago" }, "recepcionista"), true);
  assert.equal(accesoPanel({ rol: "gerente_general", hotel_id: null }, "gerente"), true);
  assert.equal(accesoPanel({ rol: "gerente_general", hotel_id: "santiago" }, "gerente"), false);
  assert.equal(esGerencia("gerente_general"), true);
  assert.equal(rutaPorRol("gerente_general"), "/gerencia");
});
test("logout/login reemplaza el rol y alcance previos por el perfil autenticado nuevo", async () => {
  let callback, state;
  const source = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (fn) => {
      callback = fn;
      return { data: { subscription: { unsubscribe() {} } } };
    },
  };
  const stop = observeAuth(
    source,
    async (id) => ({
      id,
      rol: id === "central" ? "gerente_general" : "gerente",
      hotel_id: id === "central" ? null : "santiago",
    }),
    (value) => (state = value),
  );
  const tick = () => new Promise((resolve) => setTimeout(resolve, 15));
  await tick();
  callback("SIGNED_IN", { user: { id: "central" } });
  await tick();
  assert.equal(state.perfil.rol, "gerente_general");
  callback("SIGNED_OUT", null);
  assert.equal(state.perfil, null);
  callback("SIGNED_IN", { user: { id: "local" } });
  await tick();
  assert.equal(state.perfil.rol, "gerente");
  assert.equal(state.perfil.hotel_id, "santiago");
  stop();
});
