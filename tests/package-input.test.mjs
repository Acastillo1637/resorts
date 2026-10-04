import { test } from "node:test";
import assert from "node:assert/strict";
import { formatoCLP, pegarCLP, enteroPaquete } from "../src/lib/package-input.ts";
test("CLP chileno permite miles, borrado y mantiene pesos reales", () => {
  for (const [raw, formatted] of [
    ["2000", "2.000"],
    ["20000", "20.000"],
    ["2000000", "2.000.000"],
    ["", ""],
    ["0", "0"],
  ])
    assert.equal(formatoCLP(raw), formatted);
  assert.equal(enteroPaquete(pegarCLP("2.000.000")), 2000000);
  assert.equal(pegarCLP("2000"), "2000");
  for (const raw of ["2.5", "1,5", "2,06", "-2000", "2e3"]) assert.equal(pegarCLP(raw), null);
});
test("cantidades y precios rechazan decimales, notación científica y valores fuera de rango", () => {
  for (const raw of ["2.5", "2,06", "1,5", "2e3", "-1", "", "9007199254740992"])
    assert.throws(() => enteroPaquete(raw));
  assert.throws(() => enteroPaquete("0", 1));
  assert.equal(enteroPaquete("0"), 0);
  assert.equal(enteroPaquete("2", 1), 2);
});
