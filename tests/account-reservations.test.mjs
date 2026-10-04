import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrarReservas } from "../src/lib/booking.ts";
import { datosPerfilPermitidos, validarNuevaClave } from "../src/lib/account.ts";
test("nueva contraseña exige longitud y confirmación sin alterar su contenido", () => {
  assert.doesNotThrow(() => validarNuevaClave("Clave123", "Clave123"));
  assert.doesNotThrow(() => validarNuevaClave(" Clave123 ", " Clave123 "));
  for (const [clave, confirmacion] of [
    ["corta", "corta"],
    ["        ", "        "],
    ["x".repeat(129), "x".repeat(129)],
    ["Clave123", "Clave124"],
    [" Clave123 ", "Clave123"],
  ])
    assert.throws(() => validarNuevaClave(clave, confirmacion));
});
test("activas excluye canceladas/finalizadas y confirmaciones vencidas; historial conserva todo", () => {
  const data = [
    { id: "futura", estado: "confirmada", fecha_fin: "2026-10-20" },
    { id: "pendiente", estado: "pendiente", fecha_fin: "2026-10-15" },
    { id: "en-hotel", estado: "check_in", fecha_fin: "2026-10-05" },
    { id: "vencida", estado: "confirmada", estado_vigente: "vencida", fecha_fin: "2026-10-02" },
    { id: "cancelada", estado: "cancelada", fecha_fin: "2026-10-20" },
    { id: "finalizada", estado: "check_out", fecha_fin: "2026-10-02" },
  ];
  assert.deepEqual(
    filtrarReservas(data, "activas", "2026-10-03").map((r) => r.id),
    ["futura", "pendiente", "en-hotel"],
  );
  assert.deepEqual(
    filtrarReservas(data, "cancelada", "2026-10-03").map((r) => r.id),
    ["cancelada"],
  );
  assert.equal(filtrarReservas(data, "", "2026-10-03").length, 6);
  assert.equal(data.length, 6);
});
test("actualización de cancelación sale inmediatamente de activas y permanece en historial", () => {
  const before = [{ id: "reserva", estado: "confirmada", fecha_fin: "2026-10-20" }];
  const updated = before.map((r) => ({ ...r, estado: "cancelada" }));
  assert.equal(filtrarReservas(before, "activas", "2026-10-03").length, 1);
  assert.equal(filtrarReservas(updated, "activas", "2026-10-03").length, 0);
  assert.equal(filtrarReservas(updated, "cancelada").length, 1);
  assert.equal(filtrarReservas(updated, "").length, 1);
});
test("datos del perfil incluyen exclusivamente nombre/teléfono, descartando campos protegidos", () => {
  const result = datosPerfilPermitidos({
    nombre: "  Ana Pérez  ",
    telefono: " +56 9 1234 5678 ",
    rol: "gerente",
    hotel_id: "hotel-ajeno",
    id: "usuario-ajeno",
    email: "otro@example.org",
    rut: "99999999-9",
  });
  assert.deepEqual(result, { nombre: "Ana Pérez", telefono: "+56 9 1234 5678" });
  assert.deepEqual(datosPerfilPermitidos({ nombre: "Ana", telefono: "" }), {
    nombre: "Ana",
    telefono: null,
  });
  for (const input of [
    { nombre: " ", telefono: "" },
    { nombre: "a".repeat(151), telefono: "" },
    { nombre: "Ana", telefono: "javascript:alert(1)" },
    { nombre: "Ana", telefono: "------" },
    { nombre: "Ana", telefono: "1".repeat(16) },
  ])
    assert.throws(() => datosPerfilPermitidos(input));
});
