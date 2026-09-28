import { test } from "node:test";
import assert from "node:assert/strict";
import {
  noches,
  superpone,
  validarEstancia,
  totalReserva,
  pagado,
  sumarDias,
} from "../src/lib/booking.ts";
test("noches: fechas válidas, bisiesto y cambio de horario", () => {
  assert.equal(noches("2028-02-28", "2028-03-01"), 2);
  assert.equal(noches("2026-09-05", "2026-09-07"), 2);
  assert.equal(noches("2026-02-30", "2026-03-03"), 0);
  assert.equal(noches("", "2026-03-03"), 0);
  assert.equal(noches("2026-09-05", "2026-09-05"), 0);
});
test("intervalos adyacentes no se superponen", () => {
  assert.equal(superpone("2026-10-01", "2026-10-03", "2026-10-03", "2026-10-04"), false);
  assert.equal(superpone("2026-10-01", "2026-10-03", "2026-10-02", "2026-10-04"), true);
});
test("validación de capacidad, enteros, adultos y fechas pasadas", () => {
  for (const [a, n, c] of [
    [0, 1, 2],
    [1, -1, 2],
    [2, 1, 2],
    [1.5, 0, 3],
  ])
    assert.throws(() => validarEstancia("2026-10-01", "2026-10-03", a, n, c, "2026-09-28"));
  assert.throws(() => validarEstancia("2026-09-01", "2026-10-01", 1, 0, 2, "2026-09-28"));
  assert.doesNotThrow(() => validarEstancia("2026-10-01", "2026-10-03", 2, 1, 3, "2026-09-28"));
});
test("precio histórico más servicios, pagos menos reembolsos", () => {
  const r = {
    fecha_inicio: "2026-10-01",
    fecha_fin: "2026-10-04",
    tarifa_noche: 100000,
    servicios_contratados: [{ cantidad: 2, precio_unitario: 15000 }],
    pagos: [
      { monto: 100000, tipo: "pago" },
      { monto: 25000, tipo: "reembolso" },
    ],
  };
  assert.equal(totalReserva(r), 330000);
  assert.equal(pagado(r), 75000);
});
test("sumar días cruza mes y año", () => assert.equal(sumarDias("2026-12-31", 1), "2027-01-01"));
