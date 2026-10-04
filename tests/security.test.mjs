import { test } from "node:test";
import assert from "node:assert/strict";
import { ocupacionPaquete, errorMensaje } from "../src/lib/booking.ts";
import { isPublicSupabaseKey, validatePublicEnvironment } from "../src/lib/public-config.ts";
test("hasta dos: adultos obligatorios, composiciones válidas y límites", () => {
  const p = { capacidad: 2, min_adultos: 1, max_ninos: 1, min_huespedes: 1 };
  for (const [a, n] of [
    [1, 0],
    [2, 0],
    [1, 1],
  ])
    assert.equal(ocupacionPaquete(p, a, n), true);
  for (const [a, n] of [
    [0, 2],
    [2, 1],
    [1, -1],
    [1, 2],
    [1.5, 0],
    [NaN, 0],
  ])
    assert.equal(ocupacionPaquete(p, a, n), false);
  assert.equal(ocupacionPaquete({ ...p, max_ninos: 0 }, 1, 1), false);
  assert.equal(ocupacionPaquete({ ...p, min_adultos: 2 }, 1, 1), false);
});
test("para dos exige exactamente dos y permite adulto con niño", () => {
  const p = { capacidad: 2, min_adultos: 1, max_ninos: 1, min_huespedes: 2 };
  assert.equal(ocupacionPaquete(p, 1, 0), false);
  assert.equal(ocupacionPaquete(p, 2, 0), true);
  assert.equal(ocupacionPaquete(p, 1, 1), true);
  assert.equal(ocupacionPaquete(p, 0, 2), false);
  assert.equal(ocupacionPaquete(p, 2, 1), false);
});
test("errores internos nunca se reflejan; conflictos conservan mensaje útil", () => {
  const secret = "SQL SELECT token FROM secretos; stack Trace password=private";
  for (const e of [
    new Error(secret),
    { code: "XX000", message: secret },
    { message: secret, details: secret },
  ])
    assert.ok(!errorMensaje(e).includes(secret));
  assert.match(errorMensaje({ code: "23P01", message: secret }), /ocuparse/);
  assert.match(errorMensaje({ code: "42501", message: secret }), /permiso/);
  assert.match(errorMensaje({ code: "invalid_credentials" }), /incorrectos/);
});
test("compilación rechaza claves privadas y permite solo credencial Supabase pública", () => {
  const jwt = (role) =>
    `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
  assert.equal(isPublicSupabaseKey(jwt("anon")), true);
  assert.equal(isPublicSupabaseKey(jwt("service_role")), false);
  assert.equal(isPublicSupabaseKey("sb_secret_test"), false);
  assert.equal(isPublicSupabaseKey("invalid"), false);
  assert.doesNotThrow(() =>
    validatePublicEnvironment({
      VITE_SUPABASE_ANON_KEY: jwt("anon"),
      SERVER_SECRET: "server-only",
    }),
  );
  for (const env of [
    { VITE_SUPABASE_ANON_KEY: jwt("service_role") },
    { VITE_SOMETHING: jwt("service_role") },
    { VITE_ANY: "sb_secret_test" },
    { VITE_DATABASE_URL: "postgresql://private" },
  ])
    assert.throws(() => validatePublicEnvironment(env));
});
