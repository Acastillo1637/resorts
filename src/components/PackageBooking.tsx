import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Paquete } from "@/lib/catalog";
import {
  hoy,
  sumarDias,
  noches,
  moneda,
  errorMensaje,
  ocupacionPaquete,
  type Habitacion,
} from "@/lib/booking";
import { supabase } from "@/lib/supabase";
import { rpc } from "@/lib/gestion";
import { button, input } from "./AppShell";
export function PackageBooking({
  paquete: p,
  listo,
}: {
  paquete: Paquete;
  listo?: (() => void | Promise<void>) | undefined;
}) {
  const [inicio, setInicio] = useState(hoy());
  const [adultos, setAdultos] = useState(Math.max(p.min_adultos, p.min_huespedes ?? 1));
  const [ninos, setNinos] = useState(0);
  const [habitacion, setHabitacion] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem("maremoto-busqueda") || "{}");
      if (draft.paqueteId !== p.id) return;
      if (
        typeof draft.inicio === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(draft.inicio) &&
        noches(draft.inicio, "9999-12-31") > 0 &&
        draft.inicio >= hoy()
      )
        setInicio(draft.inicio);
      if (ocupacionPaquete(p, draft.adultos, draft.ninos)) {
        setAdultos(draft.adultos);
        setNinos(draft.ninos);
      }
    } catch {
      /* Ignorar borrador inválido. */
    }
  }, [p]);
  const fin = inicio ? sumarDias(inicio, p.noches) : "";
  const valid = !!inicio && inicio >= hoy() && ocupacionPaquete(p, adultos, ninos);
  const q = useQuery({
    queryKey: ["disponibilidad-paquete", p.id, inicio, adultos, ninos],
    enabled: valid && !done,
    queryFn: async () =>
      (await rpc("fn_disponibilidad_paquete", {
        p_paquete_id: p.id,
        p_fecha_inicio: inicio,
        p_adultos: adultos,
        p_ninos: ninos,
      })) as Habitacion[],
    staleTime: 0,
  });
  const compatibles = q.data?.filter(
    (r) => r.capacidad >= adultos + ninos && r.hotel_id === p.hotel_id && r.tipo === p.tipo,
  );
  const room = compatibles?.find((r) => r.id === habitacion) ?? compatibles?.[0];
  const loading = q.isFetching;
  function guardarBorrador() {
    sessionStorage.setItem(
      "maremoto-busqueda",
      JSON.stringify({
        paqueteId: p.id,
        hotel: p.hotel.nombre,
        hotelId: p.hotel_id,
        inicio,
        fin,
        adultos,
        ninos,
      }),
    );
  }
  return (
    <form
      className="space-y-5 rounded-[28px] bg-cream p-6 ring-1 ring-ink/10"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!room || !valid || done) return;
        setBusy(true);
        setMsg("");
        try {
          guardarBorrador();
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session) {
            window.location.href = "/acceso";
            return;
          }
          // Siempre refrescar disponibilidad; la RPC de reserva valida de nuevo bajo bloqueo.
          const actual = await q.refetch();
          if (actual.error) throw actual.error;
          if (!actual.data?.some((h) => h.id === room.id))
            throw new Error("La habitación acaba de ocuparse. Selecciona otra disponible.");
          await rpc("fn_reservar_paquete", {
            p_paquete_id: p.id,
            p_habitacion_id: room.id,
            p_fecha_inicio: inicio,
            p_adultos: adultos,
            p_ninos: ninos,
            p_version: p.version,
          });
          sessionStorage.removeItem("maremoto-busqueda");
          setDone(true);
          setMsg("Reserva de paquete confirmada. Puedes verla en Mis reservas.");
          if (listo) await listo();
        } catch (err) {
          setMsg(errorMensaje(err));
          void q.refetch();
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-display text-2xl font-black">{p.nombre}</h2>
      <p className="font-bold text-accent">{moneda(Number(p.precio))} · total por habitación</p>
      {!done && (
        <>
          <label className="block text-sm">
            Entrada
            <input
              className={input}
              type="date"
              required
              min={p.vigente_desde && p.vigente_desde > hoy() ? p.vigente_desde : hoy()}
              max={p.vigente_hasta ? sumarDias(p.vigente_hasta, 1 - p.noches) : undefined}
              value={inicio}
              onChange={(e) => {
                setInicio(e.target.value);
                setHabitacion("");
                setMsg("");
              }}
            />
          </label>
          <p className="text-sm">
            Salida: {fin} · {p.noches + 1} días / {p.noches} noches
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Adultos
              <select
                className={input}
                value={adultos}
                onChange={(e) => {
                  const a = Number(e.target.value);
                  setAdultos(a);
                  setNinos(
                    Math.max(
                      Math.min(ninos, p.max_ninos, p.capacidad - a),
                      (p.min_huespedes ?? 1) - a,
                      0,
                    ),
                  );
                  setHabitacion("");
                }}
              >
                {Array.from({ length: p.capacidad }, (_, i) => i + 1)
                  .filter((a) => a >= p.min_adultos && a + p.max_ninos >= (p.min_huespedes ?? 1))
                  .map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm">
              Niños
              <select
                className={input}
                value={ninos}
                onChange={(e) => {
                  setNinos(Number(e.target.value));
                  setHabitacion("");
                }}
              >
                {Array.from(
                  { length: Math.min(p.max_ninos, p.capacidad - adultos) + 1 },
                  (_, n) => n,
                )
                  .filter((n) => ocupacionPaquete(p, adultos, n))
                  .map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-ink-soft">
            {(p.min_huespedes ?? 1) === p.capacidad ? "Para" : "Hasta"} {p.capacidad} huéspedes ·
            mínimo {p.min_adultos} adultos · máximo {p.max_ninos} niños
          </p>
          {!valid && <p role="alert">Revisa las fechas y la cantidad de huéspedes.</p>}
          {q.error && <p role="alert">{errorMensaje(q.error)}</p>}
          {loading && <p role="status">Consultando disponibilidad…</p>}
          {!loading && valid && !q.error && q.data?.length === 0 && (
            <div role="status">
              <p>
                No hay habitaciones compatibles para esas fechas. Prueba otras fechas para este
                paquete.
              </p>
              <button
                type="button"
                className="mt-3 text-sm font-bold text-accent"
                onClick={() => setInicio(sumarDias(inicio, 1))}
              >
                Consultar un día después
              </button>
            </div>
          )}
          {!!q.data?.length && (
            <label className="block text-sm">
              Habitación disponible
              <select
                className={input}
                value={room?.id ?? ""}
                onChange={(e) => setHabitacion(e.target.value)}
              >
                {compatibles?.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.numero} · {h.capacidad} huéspedes
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className={`${button} w-full`}
            disabled={busy || loading || !valid || !room || !!q.error}
          >
            {busy ? "Reservando…" : "Reservar paquete"}
          </button>
        </>
      )}
      {msg && <p role="status">{msg}</p>}
      {msg.includes("El paquete cambió") && (
        <a href={`/paquete/${p.id}`} className="block text-accent underline">
          Actualizar ficha y precio
        </a>
      )}
      {done && !listo && (
        <a href="/mis-reservas#mis-reservas" className="block font-bold text-accent">
          Ver Mis reservas
        </a>
      )}
    </form>
  );
}
