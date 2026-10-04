import { test } from "node:test";
import assert from "node:assert/strict";
import { observeAuth } from "../src/lib/auth-observer.ts";
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
const session = (id) => ({ user: { id }, access_token: "test", refresh_token: "test" });
const perfil = (id) => ({ id, rol: "cliente", nombre: "Huésped" });
function auth(initial = null, getSession) {
  let current = initial,
    callback;
  return {
    getSession: getSession ?? (async () => ({ data: { session: current }, error: null })),
    onAuthStateChange(fn) {
      callback = fn;
      return {
        data: {
          subscription: {
            unsubscribe() {
              callback = null;
            },
          },
        },
      };
    },
    event(name, value) {
      current = value;
      return callback?.(name, value);
    },
  };
}
test("sesión persistida, recarga, login/logout y renovación sin parpadeo", async () => {
  const source = auth(session("a"));
  let state;
  let loads = 0;
  let stop = observeAuth(
    source,
    async (id) => {
      loads++;
      return perfil(id);
    },
    (next) => (state = next),
  );
  await tick();
  assert.equal(state.session.user.id, "a");
  assert.equal(state.perfil.id, "a");
  assert.equal(state.loading, false);
  source.event("TOKEN_REFRESHED", session("a"));
  assert.equal(state.profileLoading, false);
  assert.equal(loads, 1);
  stop();
  stop = observeAuth(
    source,
    async (id) => perfil(id),
    (next) => (state = next),
  );
  await tick();
  assert.equal(state.session.user.id, "a");
  source.event("SIGNED_OUT", null);
  assert.equal(state.session, null);
  assert.equal(state.perfil, null);
  assert.equal(source.event("SIGNED_IN", session("b")), undefined);
  await tick();
  assert.equal(state.perfil.id, "b");
  stop();
});
test("fallo de perfil conserva sesión autenticada, sin conceder rol", async () => {
  const source = auth(session("a"));
  let state;
  const stop = observeAuth(
    source,
    async () => {
      throw new Error("SQL secreto");
    },
    (next) => (state = next),
  );
  await tick();
  assert.equal(state.session.user.id, "a");
  assert.equal(state.perfil, null);
  assert.equal(state.profileLoading, false);
  assert.match(state.error, /sesión sigue activa/);
  assert.ok(!state.error.includes("SQL"));
  stop();
});
test("getSession antiguo no restaura una sesión tras logout", async () => {
  let resolve;
  let state;
  const source = auth(null, () => new Promise((r) => (resolve = r)));
  const stop = observeAuth(
    source,
    async (id) => perfil(id),
    (next) => (state = next),
  );
  source.event("SIGNED_OUT", null);
  resolve({ data: { session: session("a") }, error: null });
  await tick();
  assert.equal(state.session, null);
  stop();
});
test("perfil antiguo no sobreescribe al siguiente usuario", async () => {
  let first;
  let state;
  const source = auth(session("a"));
  const stop = observeAuth(
    source,
    (id) => (id === "a" ? new Promise((r) => (first = r)) : Promise.resolve(perfil(id))),
    (next) => (state = next),
  );
  await tick();
  source.event("SIGNED_OUT", null);
  source.event("SIGNED_IN", session("b"));
  await tick();
  first(perfil("a"));
  await tick();
  assert.equal(state.perfil.id, "b");
  assert.equal(state.session.user.id, "b");
  stop();
});
