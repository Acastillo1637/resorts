import { test } from "node:test";
import assert from "node:assert/strict";
import { navegacionRol, accesoReserva } from "../src/lib/roles.ts";
import { nuevaIdempotencia } from "../src/lib/idempotency.ts";
import {
  reservaVigente,
  totalReserva,
  pagado,
  estadoVisible,
  filtrarReservas,
} from "../src/lib/booking.ts";
test("cliente mantiene cuenta/reservas; gerencias crean paquetes; recepción solo opera", () => {
  assert.deepEqual(
    navegacionRol("cliente").links.map((x) => x.to),
    ["/mi-cuenta", "/mis-reservas"],
  );
  for (const rol of ["gerente", "gerente_general", "recepcionista"]) {
    const nav = navegacionRol(rol);
    assert.equal(nav.reservar, false);
    assert.equal(
      nav.links.some((x) => ["/mi-cuenta", "/mis-reservas"].includes(x.to)),
      false,
    );
    assert.equal(nav.paquete, rol !== "recepcionista");
  }
});
test("detalle: hotel ajeno denegado al gerente y recepción; alcance central permitido", () => {
  for (const rol of ["gerente", "recepcionista"]) {
    assert.equal(accesoReserva({ rol, hotel_id: "santiago" }, "atacama"), false);
    assert.equal(accesoReserva({ rol, hotel_id: "santiago" }, "santiago"), true);
  }
  assert.equal(accesoReserva({ rol: "gerente_general", hotel_id: null }, "atacama"), true);
  assert.equal(accesoReserva({ rol: "cliente", hotel_id: null }, "santiago"), false);
});
test("Ver reserva genera UUID seguro sin randomUUID en HTTP LAN", () => {
  const cryptoLAN = { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) };
  const first = nuevaIdempotencia(cryptoLAN);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(first, nuevaIdempotencia(cryptoLAN));
});
test("estado calculado del backend finaliza sin cambiar el estado registrado ni saldos", () => {
  const original = {
    estado: "check_in",
    estado_vigente: "vencida",
    fecha_inicio: "2026-01-01",
    fecha_fin: "2026-01-03",
    tarifa_noche: 100,
    pagos: [{ monto: 50, tipo: "pago" }],
    servicios_contratados: [],
  };
  const normalized = reservaVigente(original);
  assert.equal(normalized.estado, "check_in");
  assert.equal(estadoVisible(normalized), "vencida");
  assert.equal(normalized.estado_registrado, "check_in");
  assert.equal(totalReserva(normalized) - pagado(normalized), 150);
  assert.equal(original.estado, "check_in");
  assert.equal(
    reservaVigente({ ...original, estado: "cancelada", estado_vigente: "cancelada" }).estado,
    "cancelada",
  );
});
test("vencidas se separan de activas y check_in sin salida queda en regularización", () => {
  const reservas = ["pendiente", "confirmada", "check_in"].map((estado) => ({
    estado,
    estado_vigente: "vencida",
    fecha_fin: "2026-01-02",
  }));
  assert.equal(filtrarReservas(reservas, "activas", "2026-01-03").length, 0);
  assert.equal(filtrarReservas(reservas, "historial").length, 3);
  assert.equal(filtrarReservas(reservas, "vencida").length, 3);
  assert.deepEqual(
    filtrarReservas(reservas, "regularizacion").map((r) => r.estado),
    ["check_in"],
  );
  assert.equal(estadoVisible({ estado: "check_out", estado_vigente: "vencida" }), "check_out");
  assert.equal(estadoVisible({ estado: "cancelada", estado_vigente: "confirmada" }), "cancelada");
});
