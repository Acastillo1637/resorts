import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, card, input, button } from "@/components/AppShell";
import { Campo, Editor } from "@/components/gestion/Forms";
import { ReservaForm } from "@/components/gestion/ReservaForm";
import { getPerfil, type Perfil } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cargarGestion, rpc } from "@/lib/gestion";
import {
  estados,
  errorMensaje,
  hoy,
  moneda,
  noches,
  pagado,
  sumarDias,
  totalReserva,
  type Habitacion,
  type Reserva,
} from "@/lib/booking";
export const Route = createFileRoute("/mi-cuenta")({ component: Cuenta });
function Cuenta() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [p, setP] = useState<Perfil | null>(null);
  const [hotel, setHotel] = useState("");
  const [tipo, setTipo] = useState("");
  const [inicio, setInicio] = useState(hoy());
  const [fin, setFin] = useState(sumarDias(hoy(), 1));
  const [adultos, setAdultos] = useState(1);
  const [ninos, setNinos] = useState(0);
  const [hab, setHab] = useState<Habitacion[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [editar, setEditar] = useState<Reserva | null>(null);
  const [filtro, setFiltro] = useState("");
  const q = useQuery({ queryKey: ["cuenta", p?.id], queryFn: cargarGestion, enabled: !!p });
  useEffect(() => {
    let activo = true;
    void getPerfil()
      .then(async (x) => {
        if (!activo) return;
        if (!x || x.rol !== "cliente") {
          await nav({ to: "/acceso" });
          return;
        }
        setP(x);
        const raw = sessionStorage.getItem("maremoto-busqueda");
        if (raw) {
          try {
            const saved = JSON.parse(raw) as { inicio?: string; fin?: string };
            if (saved.inicio && saved.inicio >= hoy()) setInicio(saved.inicio);
            if (saved.fin && saved.fin > hoy()) setFin(saved.fin);
          } catch {
            /* Ignore invalid draft. */
          }
        }
      })
      .catch((e) => setMsg(errorMensaje(e)));
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        qc.clear();
        void nav({ to: "/acceso" });
      }
    });
    return () => {
      activo = false;
      data.subscription.unsubscribe();
    };
  }, [nav, qc]);
  useEffect(() => {
    if (!q.data || hotel) return;
    let nombre = "";
    try {
      nombre = JSON.parse(sessionStorage.getItem("maremoto-busqueda") || "{}").hotel ?? "";
    } catch {
      /* Ignore invalid draft. */
    }
    setHotel(
      q.data.hoteles.find((h) => h.nombre === nombre)?.id ??
        q.data.hoteles.find((h) => h.estado === "activo")?.id ??
        "",
    );
  }, [q.data, hotel]);
  async function refrescar() {
    setEditar(null);
    setHab([]);
    await qc.invalidateQueries({ queryKey: ["cuenta"] });
  }
  async function buscar() {
    setBusy(true);
    setMsg("");
    setHab([]);
    try {
      const rows = (await rpc("fn_disponibilidad", {
        p_hotel_id: hotel,
        p_fecha_inicio: inicio,
        p_fecha_fin: fin,
        p_tipo: tipo || null,
      })) as Habitacion[];
      const filtered = rows.filter((h) => h.capacidad >= adultos + ninos);
      if (filtered.length) setHab(filtered);
      else {
        const alt = (await rpc("fn_sugerir_alternativas", {
          p_hotel_id_original: hotel,
          p_fecha_inicio: inicio,
          p_fecha_fin: fin,
          p_tipo: tipo || null,
        })) as { habitacion_id: string }[];
        const ids = new Set(alt.map((a) => a.habitacion_id));
        const alternativas =
          q.data?.habitaciones.filter((h) => ids.has(h.id) && h.capacidad >= adultos + ninos) ?? [];
        setHab(alternativas);
        setMsg(
          alternativas.length
            ? "Mostramos alternativas de la misma región."
            : "No hay habitaciones disponibles para esos criterios.",
        );
      }
    } catch (e) {
      setMsg(errorMensaje(e));
    } finally {
      setBusy(false);
    }
  }
  async function reservar(h: Habitacion) {
    if (
      !confirm(
        `¿Confirmar ${noches(inicio, fin)} noches por ${moneda(noches(inicio, fin) * Number(h.precio_noche))}?`,
      )
    )
      return;
    setBusy(true);
    try {
      await rpc("fn_guardar_reserva", {
        p_habitacion_id: h.id,
        p_fecha_inicio: inicio,
        p_fecha_fin: fin,
        p_adultos: adultos,
        p_ninos: ninos,
      });
      setMsg("Reserva confirmada.");
      await refrescar();
    } catch (e) {
      setMsg(errorMensaje(e));
    } finally {
      setBusy(false);
    }
  }
  async function cancelar(r: Reserva) {
    if (!confirm("¿Cancelar esta reserva?")) return;
    setBusy(true);
    try {
      await rpc("fn_cancelar_reserva", { p_reserva_id: r.id });
      setMsg("Reserva cancelada.");
      await refrescar();
    } catch (e) {
      setMsg(errorMensaje(e));
    } finally {
      setBusy(false);
    }
  }
  if (!p)
    return (
      <p className="p-10" role="status">
        {msg || "Verificando acceso…"}
      </p>
    );
  return (
    <AppShell perfil={p} eyebrow="Portal del huésped" title="Tu próxima escapada.">
      {(msg || q.error) && (
        <p role="status" className="mb-5 rounded-2xl bg-accent-soft p-4">
          {q.error ? errorMensaje(q.error) : msg}
        </p>
      )}
      {q.isPending ? (
        <p>Cargando…</p>
      ) : q.error ? (
        <button className={button} onClick={() => q.refetch()}>
          Reintentar
        </button>
      ) : (
        q.data && (
          <div className="grid gap-8 lg:grid-cols-5">
            <section className={`${card} lg:col-span-2`}>
              <h2 className="mb-6 text-2xl font-bold">Disponibilidad</h2>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void buscar();
                }}
                onChange={() => setHab([])}
              >
                <Campo nombre="Hotel">
                  <select
                    className={input}
                    value={hotel}
                    onChange={(e) => setHotel(e.target.value)}
                  >
                    {q.data.hoteles
                      .filter((h) => h.estado === "activo")
                      .map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.nombre}
                        </option>
                      ))}
                  </select>
                </Campo>
                <Campo nombre="Tipo">
                  <select className={input} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                    <option value="">Cualquiera</option>
                    {q.data.tipos.map((t) => (
                      <option key={t.codigo} value={t.codigo}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo nombre="Entrada">
                  <input
                    className={input}
                    type="date"
                    min={hoy()}
                    required
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                  />
                </Campo>
                <Campo nombre="Salida">
                  <input
                    className={input}
                    type="date"
                    min={sumarDias(inicio || hoy(), 1)}
                    required
                    value={fin}
                    onChange={(e) => setFin(e.target.value)}
                  />
                </Campo>
                <div className="grid grid-cols-2 gap-3">
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
                </div>
                <button className={`${button} w-full`} disabled={busy || !hotel}>
                  {busy ? "Procesando…" : "Buscar disponibilidad"}
                </button>
              </form>
              {hab.map((h) => (
                <article key={h.id} className="mt-5 rounded-2xl border border-ink/10 p-4">
                  <b>
                    {q.data?.hoteles.find((x) => x.id === h.hotel_id)?.nombre} · {h.numero}
                  </b>
                  <p className="my-2 text-sm">
                    {h.tipo} · {h.capacidad} personas
                    <br />
                    {noches(inicio, fin)} noches ·{" "}
                    {moneda(noches(inicio, fin) * Number(h.precio_noche))}
                  </p>
                  <button className={button} disabled={busy} onClick={() => reservar(h)}>
                    Reservar
                  </button>
                </article>
              ))}
            </section>
            <section className={`${card} lg:col-span-3`}>
              <h2 className="mb-6 text-2xl font-bold">Mis reservas</h2>
              <Campo nombre="Filtrar estado">
                <select
                  className={input}
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                >
                  <option value="">Todos</option>
                  {Object.entries(estados).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Campo>
              <div className="mt-5 space-y-4">
                {!q.data.reservas.length && <p>Aún no tienes reservas.</p>}
                {q.data.reservas
                  .filter((r) => !filtro || r.estado === filtro)
                  .map((r) => (
                    <article key={r.id} className="rounded-2xl border border-ink/10 p-4">
                      <b>
                        {q.data?.hoteles.find((h) => h.id === r.hotel_id)?.nombre} · Hab.{" "}
                        {q.data?.habitaciones.find((h) => h.id === r.habitacion_id)?.numero}
                      </b>
                      <p className="my-2 text-sm">
                        {r.fecha_inicio} → {r.fecha_fin} · {estados[r.estado]}
                        <br />
                        {r.adultos} adultos · {r.ninos} niños
                        <br />
                        Total: {moneda(totalReserva(r))} · Abonado: {moneda(pagado(r))}
                      </p>
                      {["confirmada", "pendiente"].includes(r.estado) && (
                        <div className="flex gap-3">
                          <button className={button} disabled={busy} onClick={() => setEditar(r)}>
                            Editar
                          </button>
                          <button className={button} disabled={busy} onClick={() => cancelar(r)}>
                            Cancelar
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
              </div>
            </section>
          </div>
        )
      )}
      {editar && q.data && (
        <Editor titulo="Editar mi reserva" cerrar={() => setEditar(null)}>
          <ReservaForm
            datos={q.data}
            hotel={editar.hotel_id}
            reserva={editar}
            cliente
            listo={refrescar}
          />
        </Editor>
      )}
    </AppShell>
  );
}
