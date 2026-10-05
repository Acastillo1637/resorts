import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, card, input, button } from "@/components/AppShell";
import { Campo, Editor } from "@/components/gestion/Forms";
import { ReservaForm } from "@/components/gestion/ReservaForm";
import { rutaPorRol } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useConfirmation } from "@/hooks/use-confirmation";
import { cancellationConfirmation } from "@/lib/confirmation";
import { cargarGestion, rpc } from "@/lib/gestion";
import { cargarPaquetes, type Paquete } from "@/lib/catalog";
import { useCatalogo } from "@/hooks/use-catalogo";
import { HotelCover } from "@/components/HotelCover";
import { PackageBooking } from "@/components/PackageBooking";
import {
  estados,
  estadoVisible,
  errorMensaje,
  hoy,
  moneda,
  noches,
  pagado,
  sumarDias,
  totalReserva,
  filtrarReservas,
  type Habitacion,
  type Reserva,
} from "@/lib/booking";
export const Route = createFileRoute("/mis-reservas")({ component: Cuenta });
function Cuenta() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const auth = useAuth();
  const p = auth.session && auth.perfil?.rol === "cliente" ? auth.perfil : null;
  const initialized = useRef("");
  const { confirm: askConfirmation, dialog } = useConfirmation();
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
  const [filtro, setFiltro] = useState("activas");
  const [paqueteId, setPaqueteId] = useState("");
  const [habitacionId, setHabitacionId] = useState("");
  const paquetes = useQuery({ queryKey: ["paquetes"], queryFn: cargarPaquetes, enabled: !!p });
  const paquete: Paquete | undefined = paquetes.data?.find((x) => x.id === paqueteId);
  const q = useQuery({ queryKey: ["cuenta", p?.id], queryFn: cargarGestion, enabled: !!p });
  const catalogo = useCatalogo();
  const seleccionado = catalogo.data?.find((h) => h.id === hotel);
  useEffect(() => {
    if (!paquete) return;
    setHotel(paquete.hotel_id);
    setFin(sumarDias(inicio, paquete.noches));
  }, [paquete, inicio]);
  useEffect(() => {
    if (auth.loading || auth.profileLoading) return;
    if (!auth.session) {
      if (!auth.error) {
        qc.clear();
        void nav({ to: "/acceso" });
      }
      return;
    }
    if (auth.perfil && auth.perfil.rol !== "cliente") {
      void nav({ to: rutaPorRol(auth.perfil.rol) } as never);
      return;
    }
    if (p && initialized.current !== p.id) {
      initialized.current = p.id;
      const raw = sessionStorage.getItem("maremoto-busqueda");
      if (raw) {
        try {
          const saved = JSON.parse(raw) as {
            inicio?: string;
            fin?: string;
            paqueteId?: string;
            habitacionId?: string;
          };
          setPaqueteId(saved.paqueteId ?? "");
          setHabitacionId(saved.habitacionId ?? "");
          if (saved.inicio && saved.inicio >= hoy()) setInicio(saved.inicio);
          if (saved.fin && saved.fin > hoy()) setFin(saved.fin);
        } catch {
          /* Ignore invalid draft. */
        }
      }
    }
  }, [nav, qc, auth.loading, auth.profileLoading, auth.session, auth.perfil, auth.error, p]);
  useEffect(() => {
  if (!q.data || hotel) return;

  let nombre = "";
  try {
    nombre = JSON.parse(sessionStorage.getItem("maremoto-busqueda") || "{}").hotel ?? "";
  } catch {
    /* Ignore invalid draft. */
  }

  if (nombre) {
    setHotel(q.data.hoteles.find((h) => h.nombre === nombre)?.id ?? "");
  }
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
      if (q.data?.hoteles.find((h) => h.id === hotel)?.reservable === false)
        throw new Error(
          "Este hotel aún no tiene inventario verificado en Almond Resorts. Consulta su sitio oficial o elige otro establecimiento.",
        );
      if (paqueteId && !paquete)
        throw new Error(
          "El paquete ya no está disponible. Elige alojamiento sin paquete o vuelve a Explorar.",
        );
      const rows = (await rpc("fn_disponibilidad", {
        p_hotel_id: hotel,
        p_fecha_inicio: inicio,
        p_fecha_fin: fin,
        p_tipo: paquete?.tipo || tipo || null,
      })) as Habitacion[];
      const filtered = rows.filter(
        (h) => h.capacidad >= adultos + ninos && (!habitacionId || h.id === habitacionId),
      );
      if (filtered.length) setHab(filtered);
      else {
        if (paqueteId || habitacionId) {
          setMsg(
            "No hay cupos disponibles para esta selección. Puedes consultar alojamiento sin paquete.",
          );
          return;
        }
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
    const precio = noches(inicio, fin) * Number(h.precio_noche);
    const ok = await askConfirmation(
      {
        title: "Confirmar reserva",
        message: `¿Confirmar ${noches(inicio, fin)} noches por ${moneda(precio)}?`,
        label: "CONFIRMAR RESERVA",
      },
      async () => {
        await rpc("fn_guardar_reserva", {
          p_habitacion_id: h.id,
          p_fecha_inicio: inicio,
          p_fecha_fin: fin,
          p_adultos: adultos,
          p_ninos: ninos,
        });
      },
    );
    if (ok) {
      setMsg("Reserva confirmada.");
      sessionStorage.removeItem("maremoto-busqueda");
      setPaqueteId("");
      setHabitacionId("");
      await refrescar();
    }
  }
  async function cancelar(r: Reserva) {
    const ok = await askConfirmation(cancellationConfirmation, async () => {
      const updated = (await rpc("fn_cancelar_reserva", { p_reserva_id: r.id })) as Reserva;
      qc.setQueryData<Awaited<ReturnType<typeof cargarGestion>>>(["cuenta", p?.id], (previous) =>
        previous
          ? {
              ...previous,
              reservas: previous.reservas.map((item) =>
                item.id === r.id ? { ...item, ...updated } : item,
              ),
            }
          : previous,
      );
    });
    if (ok) {
      setMsg("Reserva cancelada.");
      await refrescar();
    }
  }
  if (!p)
    return (
      <p className="p-10" role="status">
        {auth.error || msg || "Verificando acceso…"}
        {auth.error && (
          <button className={`${button} ml-4`} onClick={auth.retry}>
            Reintentar
          </button>
        )}
      </p>
    );
  return (
    <AppShell perfil={p} eyebrow="Portal del huésped" title="Tu próxima escapada.">
      {dialog}
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
              {hotel && (
                <div className="mb-6">
                  <HotelCover
                    key={hotel}
                    image={seleccionado?.image}
                    name={
                      seleccionado?.name ??
                      q.data?.hoteles.find((h) => h.id === hotel)?.nombre ??
                      "Hotel seleccionado"
                    }
                    ambient={seleccionado?.imagenAmbiente ?? true}
                  />
                </div>
              )}
              {paqueteId && (
                <div className="mb-5 rounded-2xl bg-accent-soft p-4">
                  <p>
                    {paquete
                      ? `${paquete.nombre} · ${paquete.noches} noches`
                      : paquetes.isPending
                        ? "Cargando paquete…"
                        : "El paquete ya no está disponible. Puedes reservar sin paquete."}
                  </p>
                  {paquete && (
                    <p className="mt-2 text-sm">
                      Incluye alojamiento
                      {paquete.servicios.length
                        ? ` · ${paquete.servicios.map((s) => s.nombre).join(" · ")}`
                        : ""}
                    </p>
                  )}
                  {paquetes.error && <p role="alert">{errorMensaje(paquetes.error)}</p>}
                  <button
                    type="button"
                    className="mt-3 text-sm font-bold text-accent"
                    onClick={() => {
                      setPaqueteId("");
                      setHabitacionId("");
                      setHab([]);
                    }}
                  >
                    Consultar sin paquete
                  </button>
                </div>
              )}
              {paquete && (
                <PackageBooking
                  key={paquete.id}
                  paquete={paquete}
                  listo={async () => {
                    setPaqueteId("");
                    setHabitacionId("");
                    await refrescar();
                    setMsg("Reserva de paquete confirmada.");
                  }}
                />
              )}
              {!paqueteId && (
                <>
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
                        onChange={(e) => {
                          setHotel(e.target.value);
                          setPaqueteId("");
                          setHabitacionId("");
                        }}
                      >
                        <option value="">Seleccionar hotel...</option>
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
                      <select
                        className={input}
                        disabled={!!paqueteId}
                        value={paquete?.tipo || tipo}
                        onChange={(e) => {
                          setTipo(e.target.value);
                          setHabitacionId("");
                        }}
                      >
                        <option value="">Elige una opción</option>
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
                        onChange={(e) => {
                          setInicio(e.target.value);
                          if (paquete) setFin(sumarDias(e.target.value, paquete.noches));
                        }}
                      />
                    </Campo>
                    <Campo nombre="Salida">
                      <input
                        className={input}
                        type="date"
                        min={sumarDias(inicio || hoy(), 1)}
                        readOnly={!!paqueteId}
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
                    <button
                      className={`${button} w-full`}
                      disabled={busy || !hotel || (!!paqueteId && !paquete)}
                    >
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
                </>
              )}
            </section>
            <section id="mis-reservas" className={`${card} scroll-mt-40 lg:col-span-3`}>
              <h2 className="mb-6 text-2xl font-bold">Mis reservas</h2>
              <Campo nombre="Filtrar estado">
                <select
                  className={input}
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                >
                  <option value="activas">Activas / vigentes</option>
                  <option value="">Todas</option>
                  {Object.entries(estados).map(([k, v]) => (
                    <option key={k} value={k}>
                      {k === "cancelada" ? "Canceladas" : v}
                    </option>
                  ))}
                </select>
              </Campo>
              <div className="mt-5 space-y-4">
                {!filtrarReservas(q.data.reservas, filtro).length && (
                  <p>
                    {filtro === "activas"
                      ? "No tienes reservas activas. Puedes consultar tu historial en Canceladas o Todas."
                      : "No hay reservas para este filtro."}
                  </p>
                )}
                {filtrarReservas(q.data.reservas, filtro).map((r) => (
                  <article key={r.id} className="rounded-2xl border border-ink/10 p-4">
                    <b>
                      {r.paquete_id && (
                        <span className="mb-2 block text-accent">
                          Paquete · {r.paquete_snapshot?.nombre ?? "Estadía contratada"}
                        </span>
                      )}
                      {q.data?.hoteles.find((h) => h.id === r.hotel_id)?.nombre} · Hab.{" "}
                      {q.data?.habitaciones.find((h) => h.id === r.habitacion_id)?.numero}
                    </b>
                    <p className="my-2 text-sm">
                      {r.fecha_inicio} → {r.fecha_fin} · {estados[estadoVisible(r)]}
                      <br />
                      {r.adultos} adultos · {r.ninos} niños
                      <br />
                      Total: {moneda(totalReserva(r))} · Abonado: {moneda(pagado(r))}
                    </p>
                    {!!r.servicios_contratados.length && (
                      <p className="mb-3 text-sm text-ink-soft">
                        Servicios:{" "}
                        {r.servicios_contratados
                          .map(
                            (s) =>
                              `${s.nombre_contratado ?? s.servicios_adicionales?.nombre ?? "Servicio"} × ${s.cantidad}`,
                          )
                          .join(" · ")}
                      </p>
                    )}
                    {r.paquete_id && (
                      <p className="mb-3 text-xs text-ink-soft">
                        Reserva con paquete. Para cambiar fechas o habitación, contacta al hotel.
                      </p>
                    )}
                    {estadoVisible(r) !== "vencida" &&
                      ["confirmada", "pendiente"].includes(r.estado) && (
                        <div className="flex gap-3">
                          <button
                            className={button}
                            disabled={busy || !!r.paquete_id}
                            onClick={() => setEditar(r)}
                          >
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
