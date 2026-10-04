import { test } from "node:test";
import assert from "node:assert/strict";
import { createConfirmation, cancellationConfirmation } from "../src/lib/confirmation.ts";
import { errorMensaje } from "../src/lib/booking.ts";
test("cerrar la confirmación resuelve sin ejecutar la cancelación", async () => {
  let state,
    calls = 0;
  const c = createConfirmation((next) => (state = next), errorMensaje);
  const answer = c.ask(cancellationConfirmation, async () => {
    calls++;
  });
  assert.equal(state.options.title, "Cancelar reserva");
  assert.equal(state.options.message, "¿Estás seguro de que deseas cancelar esta reserva?");
  assert.equal(state.options.label, "CANCELAR RESERVA");
  assert.equal(state.options.destructive, true);
  c.cancel();
  assert.equal(await answer, false);
  assert.equal(state, null);
  assert.equal(calls, 0);
});
test("doble envío bloqueado y modal cerrado solo tras éxito", async () => {
  let state,
    resolve,
    calls = 0;
  const c = createConfirmation((next) => (state = next), errorMensaje);
  const answer = c.ask(cancellationConfirmation, () => {
    calls++;
    return new Promise((r) => (resolve = r));
  });
  const request = c.submit();
  await c.submit();
  c.cancel();
  assert.equal(calls, 1);
  assert.equal(state.busy, true);
  resolve();
  await request;
  assert.equal(await answer, true);
  assert.equal(state, null);
});
test("fallo de RPC queda dentro del modal y permite reintentar", async () => {
  let state,
    calls = 0;
  const c = createConfirmation((next) => (state = next), errorMensaje);
  const answer = c.ask(cancellationConfirmation, async () => {
    if (++calls === 1) throw { code: "42501", message: "SQL interno" };
  });
  await c.submit();
  assert.equal(state.busy, false);
  assert.match(state.error, /permiso/);
  assert.ok(!state.error.includes("SQL"));
  await c.submit();
  assert.equal(await answer, true);
  assert.equal(state, null);
  assert.equal(calls, 2);
});
