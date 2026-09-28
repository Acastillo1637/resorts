import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AppShell, button, card, input } from "../AppShell";
import { getPerfil, type Perfil, type Rol } from "@/lib/auth";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { cargarGestion } from "@/lib/gestion";
import {
  estados,
  errorMensaje,
  hoy,
  moneda,
  pagado,
  sumarDias,
  superpone,
  titular,
  totalReserva,
  type Reserva,
} from "@/lib/booking";
import { Campo, Editor } from "./Forms";
import { ReservaForm } from "./ReservaForm";
import { Catalogos } from "./Catalogos";
import { DetalleReserva } from "./DetalleReserva";

export function PanelGestion({ rol }: { rol: Rol }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [authError, setAuthError] = useState("");
  const [hotel, setHotel] = useState("");
  const [tab, setTab] = useState("Resumen");
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const [habitacion, setHabitacion] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [modal, setModal] = useState<"crear" | "editar" | "detalle" | null>(null);
  const [id, setId] = useState("");
  const [mensaje, setMensaje] = useState("");
  useEffect(() => {
    let activo = true;
    async function comprobar() {
      try {
        if (!supabaseConfigured) throw new Error("Configura Supabase para acceder a la gestión.");
        const p = await getPerfil();
        if (!activo) return;
        if (!p || p.rol !== rol) {
          await nav({ to: "/acceso" });
          return;
        }
        setPerfil(p);
        setHotel(p.hotel_id ?? "");
      } catch (e) {
        if (activo) setAuthError(errorMensaje(e));
      }
    }
    void comprobar();
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
  }, [nav, qc, rol]);
  const query = useQuery({
    queryKey: ["gestion", perfil?.id],
    queryFn: cargarGestion,
    enabled: !!perfil,
    refetchInterval: 60000,
  });
  const datos = query.data;
  useEffect(() => {
    if (!perfil) return;
    const ch = supabase
      .channel("gestion-" + perfil.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservas" }, () => {
        void qc.invalidateQueries({ queryKey: ["gestion"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [perfil, qc]);
  async function listo() {
    setModal(null);
    setMensaje("Cambios guardados.");
    await qc.invalidateQueries({ queryKey: ["gestion"] });
  }
  function ver(r: Reserva) {
    setId(r.id);
    setModal("detalle");
  }
  if (!perfil)
    return (
      <main className="p-10" role="status">
        {authError || "Verificando acceso…"}
        {authError && (
          <a className="ml-4 underline" href="/acceso">
            Volver al acceso
          </a>
        )}
      </main>
    );
  if (!datos)
    return (
      <AppShell perfil={perfil} eyebrow="Operación" title="Gestión hotelera">
        <p role={query.error ? "alert" : "status"}>
          {query.error ? errorMensaje(query.error) : "Cargando datos…"}
        </p>
        {query.error && (
          <button className={button} onClick={() => query.refetch()}>
            Reintentar
          </button>
        )}
      </AppShell>
    );
  const hoteles = datos.hoteles.filter((h) => !perfil.hotel_id || h.id === perfil.hotel_id);
  const rooms = datos.habitaciones.filter(
    (h) => (!hotel || h.hotel_id === hotel) && (!perfil.hotel_id || h.hotel_id === perfil.hotel_id),
  );
  const all = datos.reservas.filter((r) => !hotel || r.hotel_id === hotel);
  const reservas = all
    .filter(
      (r) =>
        (!estado || r.estado === estado) &&
        (!habitacion || r.habitacion_id === habitacion) &&
        (!desde || r.fecha_fin > desde) &&
        (!hasta || r.fecha_inicio <= hasta) &&
        `${r.id} ${titular(r)} ${datos.habitaciones.find((h) => h.id === r.habitacion_id)?.numero ?? ""}`
          .toLowerCase()
          .includes(busqueda.toLowerCase()),
    )
    .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
  const activas = all.filter((r) => ["pendiente", "confirmada", "check_in"].includes(r.estado));
  const ocupadas = new Set(all.filter((r) => r.estado === "check_in").map((r) => r.habitacion_id));
  const disponibles = rooms.filter(
    (h) =>
      h.estado === "activa" &&
      !activas.some(
        (r) =>
          r.habitacion_id === h.id &&
          superpone(r.fecha_inicio, r.fecha_fin, hoy(), sumarDias(hoy(), 1)),
      ),
  );
  const denominador = rooms.filter((h) => h.estado === "activa").length;
  const detalle = datos.reservas.find((r) => r.id === id);
  const metricas = [
    ["Reservas", all.length],
    ["Alojados", ocupadas.size],
    ["Disponibles hoy", disponibles.length],
    ["Ocupación", `${denominador ? Math.round((ocupadas.size / denominador) * 100) : 0}%`],
    ["Pendientes", all.filter((r) => r.estado === "pendiente").length],
    ["Confirmadas", all.filter((r) => r.estado === "confirmada").length],
    ["Canceladas", all.filter((r) => r.estado === "cancelada").length],
    ["Cobros netos", moneda(all.reduce((n, r) => n + pagado(r), 0))],
  ];
  const hotelNombre = (id: string) => datos.hoteles.find((h) => h.id === id)?.nombre ?? "";
  const tabla = (rows: Reserva[]) => (
    <div className="overflow-x-auto">
      {!rows.length ? (
        <p className="py-8 text-sm text-ink-soft">No hay reservas para estos filtros.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10">
              {[
                "Huésped / hotel",
                "Estancia",
                "Habitación",
                "Estado",
                "Total / saldo",
                "Gestión",
              ].map((t) => (
                <th className="p-3" key={t}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ink/10">
                <td className="p-3">
                  <b>{titular(r)}</b>
                  <p className="text-xs text-ink-soft">
                    {hotelNombre(r.hotel_id)} · {r.id.slice(0, 8)}
                  </p>
                </td>
                <td className="whitespace-nowrap p-3">
                  {r.fecha_inicio} → {r.fecha_fin}
                  <p className="text-xs">
                    {r.adultos} adultos · {r.ninos} niños
                  </p>
                </td>
                <td className="p-3">
                  {datos.habitaciones.find((h) => h.id === r.habitacion_id)?.numero}
                </td>
                <td className="p-3">
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-xs">
                    {estados[r.estado]}
                  </span>
                </td>
                <td className="whitespace-nowrap p-3">
                  {moneda(totalReserva(r))}
                  <p className="text-xs text-ink-soft">
                    Saldo: {moneda(r.estado === "cancelada" ? 0 : totalReserva(r) - pagado(r))}
                  </p>
                </td>
                <td className="p-3">
                  <button className={button} onClick={() => ver(r)}>
                    Ver reserva
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
  return (
    <AppShell
      perfil={perfil}
      eyebrow={rol === "gerente" ? "Gerencia" : "Recepción"}
      title="Gestión de estadías"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <Campo nombre="Establecimiento">
          <select
            className={input}
            value={hotel}
            disabled={!!perfil.hotel_id}
            onChange={(e) => {
              setHotel(e.target.value);
              setHabitacion("");
            }}
          >
            <option value="">Todos los hoteles</option>
            {hoteles.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <button className={button} disabled={!hotel} onClick={() => setModal("crear")}>
          Nueva reserva
        </button>
      </div>
      {!hotel && (
        <p className="mb-4 text-sm text-ink-soft">
          Selecciona un hotel para crear reservas y fichas.
        </p>
      )}
      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Secciones de gestión">
        {[
          "Resumen",
          "Reservas",
          "Calendario",
          "Huéspedes",
          "Habitaciones",
          "Hoteles",
          "Servicios",
        ].map((t) => (
          <button
            key={t}
            aria-current={tab === t ? "page" : undefined}
            className={`rounded-full px-5 py-3 text-sm font-bold ${tab === t ? "bg-ink text-cream" : "bg-cream ring-1 ring-ink/10"}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {mensaje && (
        <p role="status" className="mb-5 rounded-2xl bg-accent-soft p-4">
          {mensaje}
        </p>
      )}
      {query.error && <p role="alert">No se pudo actualizar: {errorMensaje(query.error)}</p>}
      {tab === "Resumen" && (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metricas.map(([label, value]) => (
              <div className={card} key={label}>
                <p className="text-sm text-ink-soft">{label}</p>
                <p className="mt-2 font-display text-3xl font-black text-accent">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-ink-soft">
            Disponibilidad de hoy ({hoy()}). Cobros netos: pagos menos reembolsos de todas las
            fechas del hotel seleccionado.
          </p>
          <section className={card}>
            <h2 className="mb-4 text-xl font-bold">Próximas llegadas · 7 días</h2>
            {tabla(
              activas.filter(
                (r) =>
                  r.estado !== "check_in" &&
                  r.fecha_inicio >= hoy() &&
                  r.fecha_inicio <= sumarDias(hoy(), 7),
              ),
            )}
          </section>
          <section className={card}>
            <h2 className="mb-4 text-xl font-bold">Próximas salidas y salidas atrasadas</h2>
            {tabla(
              all.filter((r) => r.estado === "check_in" && r.fecha_fin <= sumarDias(hoy(), 7)),
            )}
          </section>
        </div>
      )}
      {tab === "Reservas" && (
        <section className={card}>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Campo nombre="Buscar huésped, ID o habitación">
              <input
                className={input}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </Campo>
            <Campo nombre="Estado">
              <select className={input} value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(estados).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo nombre="Habitación">
              <select
                className={input}
                value={habitacion}
                onChange={(e) => setHabitacion(e.target.value)}
              >
                <option value="">Todas</option>
                {rooms.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.numero}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo nombre="Desde">
              <input
                className={input}
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </Campo>
            <Campo nombre="Hasta">
              <input
                className={input}
                type="date"
                value={hasta}
                min={desde}
                onChange={(e) => setHasta(e.target.value)}
              />
            </Campo>
          </div>
          <p className="mb-3 text-sm">
            {reservas.length} reservas · incluye estancias que cruzan el intervalo.
          </p>
          {tabla(reservas)}
        </section>
      )}
      {tab === "Calendario" && (
        <section className={card}>
          <Campo nombre="Inicio del calendario">
            <input
              className={input}
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value || hoy())}
            />
          </Campo>
          <p className="my-4 text-sm">
            14 días · Selecciona una reserva para gestionarla. Verde: alojado; ámbar: pendiente;
            violeta: confirmada.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-3 text-left">Habitación</th>
                  {Array.from({ length: 14 }, (_, i) => (
                    <th className="p-2" key={i}>
                      {sumarDias(fecha, i).slice(5)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map((h) => (
                  <tr key={h.id}>
                    <th className="whitespace-nowrap p-3 text-left">
                      {h.numero}
                      <p className="text-xs font-normal">{hotelNombre(h.hotel_id)}</p>
                    </th>
                    {Array.from({ length: 14 }, (_, i) => {
                      const dia = sumarDias(fecha, i);
                      const r = activas.find(
                        (r) =>
                          r.habitacion_id === h.id && r.fecha_inicio <= dia && r.fecha_fin > dia,
                      );
                      return (
                        <td className="p-1" key={i}>
                          {r ? (
                            <button
                              title={titular(r)}
                              className={`min-w-20 rounded-lg p-2 text-xs ${r.estado === "check_in" ? "bg-green-100" : r.estado === "pendiente" ? "bg-amber-100" : "bg-accent-soft"}`}
                              onClick={() => ver(r)}
                            >
                              {estados[r.estado]}
                            </button>
                          ) : (
                            <span className="block min-w-20 rounded-lg bg-paper p-2 text-center text-xs">
                              {h.estado === "activa" ? "Libre" : h.estado}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {["Huéspedes", "Habitaciones", "Hoteles", "Servicios"].includes(tab) && (
        <Catalogos
          key={tab + hotel}
          tab={tab}
          datos={datos}
          hotel={hotel}
          perfil={perfil}
          listo={listo}
        />
      )}
      {tab === "Huéspedes" && (
        <section className={`${card} mt-5`}>
          <h2 className="mb-4 font-bold">Huéspedes con cuenta web · historial</h2>
          {tabla(all.filter((r) => r.cliente_id !== null))}
        </section>
      )}
      {(modal === "crear" || modal === "editar") && (
        <Editor
          titulo={modal === "crear" ? "Nueva reserva" : "Editar reserva"}
          cerrar={() => setModal(null)}
        >
          <ReservaForm
            datos={datos}
            hotel={modal === "editar" ? (detalle?.hotel_id ?? hotel) : hotel}
            reserva={modal === "editar" ? detalle : undefined}
            listo={listo}
          />
        </Editor>
      )}
      {modal === "detalle" && detalle && (
        <Editor titulo={`Reserva ${detalle.id.slice(0, 8)}`} cerrar={() => setModal(null)}>
          <DetalleReserva
            key={detalle.id}
            r={detalle}
            datos={datos}
            listo={listo}
            editar={() => setModal("editar")}
          />
        </Editor>
      )}
    </AppShell>
  );
}
