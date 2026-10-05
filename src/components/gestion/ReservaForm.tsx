import { useState } from "react";
import { input, button } from "../AppShell";
import { Campo } from "./Forms";
import {
  errorMensaje,
  hoy,
  moneda,
  noches,
  sumarDias,
  validarEstancia,
  type Reserva,
  type Habitacion,
} from "@/lib/booking";
import { rpc, type Gestion } from "@/lib/gestion";
export function ReservaForm({
  datos,
  hotel,
  reserva,
  cliente = false,
  listo,
}: {
  datos: Gestion;
  hotel: string;
  reserva?: Reserva | undefined;
  cliente?: boolean;
  listo: () => Promise<void>;
}) {
  const [inicio, setInicio] = useState(reserva?.fecha_inicio ?? hoy());
  const [fin, setFin] = useState(reserva?.fecha_fin ?? sumarDias(hoy(), 1));
  const [adultos, setAdultos] = useState(reserva?.adultos ?? 1);
  const [ninos, setNinos] = useState(reserva?.ninos ?? 0);
  const [habitacion, setHabitacion] = useState(reserva?.habitacion_id ?? "");
  const [huesped, setHuesped] = useState(reserva?.huesped_id ?? "");
  const [estado, setEstado] = useState(reserva?.estado ?? "confirmada");
  const [notas, setNotas] = useState(reserva?.notas ?? "");
  const [version] = useState(reserva?.version ?? null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [disponibles, setDisponibles] = useState<string[] | null>(null);
  const habitaciones = datos.habitaciones.filter(
    (h) => h.hotel_id === hotel && h.estado === "activa",
  );
  const h = habitaciones.find((x) => x.id === habitacion);
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          if (!h) throw new Error("Selecciona una habitación.");
          validarEstancia(inicio, fin, adultos, ninos, h.capacidad);
          await rpc("fn_guardar_reserva", {
            p_habitacion_id: habitacion,
            p_fecha_inicio: inicio,
            p_fecha_fin: fin,
            p_adultos: adultos,
            p_ninos: ninos,
            p_huesped_id: reserva ? null : huesped || null,
            p_reserva_id: reserva?.id ?? null,
            p_version: version,
            p_estado: estado,
            p_notas: notas,
          });
          await listo();
        } catch (err) {
          setError(errorMensaje(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Campo nombre="Entrada">
        <input
          className={input}
          type="date"
          required
          min={hoy()}
          value={inicio}
          onChange={(e) => {
            setInicio(e.target.value);
            setDisponibles(null);
          }}
        />
      </Campo>
      <Campo nombre="Salida">
        <input
          className={input}
          type="date"
          required
          min={sumarDias(inicio || hoy(), 1)}
          value={fin}
          onChange={(e) => {
            setFin(e.target.value);
            setDisponibles(null);
          }}
        />
      </Campo>
      <Campo nombre="Adultos">
        <input
          className={input}
          type="number"
          min="1"
          required
          value={adultos}
          onChange={(e) => setAdultos(Number(e.target.value))}
        />
      </Campo>
      <Campo nombre="Niños">
        <input
          className={input}
          type="number"
          min="0"
          required
          value={ninos}
          onChange={(e) => setNinos(Number(e.target.value))}
        />
      </Campo>
      <button
        className={button}
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const rows = (await rpc("fn_disponibilidad", {
              p_hotel_id: hotel,
              p_fecha_inicio: inicio,
              p_fecha_fin: fin,
            })) as Habitacion[];
            setDisponibles(rows.filter((x) => x.capacidad >= adultos + ninos).map((x) => x.id),);
          } catch (err) {
            setError(errorMensaje(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        Consultar disponibilidad
      </button>
      {disponibles && (
        <p className="text-sm">
          {disponibles.length} habitaciones libres. Al editar se conserva la habitación actual si
          las fechas no se superponen con otra reserva.
        </p>
      )}
      <Campo nombre="Habitación">
        <select
          className={input}
          required
          value={habitacion}
          onChange={(e) => setHabitacion(e.target.value)}
        >
          <option value="">Seleccionar…</option>
          {habitaciones
            .filter(
              (x) => !disponibles || disponibles.includes(x.id) || x.id === reserva?.habitacion_id,
            )
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.numero} · {x.tipo} · {x.capacidad} personas · {moneda(Number(x.precio_noche))}
              </option>
            ))}
        </select>
      </Campo>
      {!cliente && !reserva && (
        <Campo nombre="Huésped">
          <select
            className={input}
            required
            value={huesped}
            onChange={(e) => setHuesped(e.target.value)}
          >
            <option value="">Seleccionar ficha…</option>
            {datos.huespedes
              .filter((x) => x.hotel_id === hotel)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre} · {x.documento}
                </option>
              ))}
          </select>
        </Campo>
      )}
      <Campo nombre="Estado">
        <select
          className={input}
          value={estado}
          onChange={(e) => setEstado(e.target.value as typeof estado)}
        >
          <option value="confirmada">Confirmada</option>
          <option value="pendiente">Pendiente</option>
        </select>
      </Campo>
      <Campo nombre="Observaciones">
        <input
          className={input}
          maxLength={1000}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </Campo>
      <p className="sm:col-span-2">
        {noches(inicio, fin)} noches · Alojamiento:{" "}
        <strong>
          {moneda(
            noches(inicio, fin) *
              Number(
                h?.id === reserva?.habitacion_id
                  ? (reserva?.tarifa_noche ?? 0)
                  : (h?.precio_noche ?? 0),
              ),
          )}
        </strong>
        . Servicios adicionales se cobran aparte.
      </p>
      {error && (
        <p role="alert" className="text-red-700 sm:col-span-2">
          {error}
        </p>
      )}
      <button className={`${button} sm:col-span-2`} disabled={busy}>
        {busy ? "Procesando…" : reserva ? "Guardar reserva" : "Crear reserva"}
      </button>
    </form>
  );
}
