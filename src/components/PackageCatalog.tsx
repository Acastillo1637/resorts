import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cargarPaquetes } from "@/lib/catalog";
import { errorMensaje, moneda } from "@/lib/booking";
import { HotelCover } from "./HotelCover";
import { input, button } from "./AppShell";
export function PackageCatalog() {
  const [zona, setZona] = useState("");
  const [duracion, setDuracion] = useState("");
  const [huespedes, setHuespedes] = useState(0);
  const [experiencia, setExperiencia] = useState("");
  const q = useQuery({ queryKey: ["paquetes"], queryFn: cargarPaquetes });
  if (q.isPending) return <p role="status">Cargando paquetes…</p>;
  if (q.error)
    return (
      <div role="alert">
        <p>{errorMensaje(q.error)}</p>
        <button className={button} onClick={() => q.refetch()}>
          Reintentar
        </button>
      </div>
    );
  const items = q.data.filter(
    (p) =>
      (!zona || p.hotel.zona === zona) &&
      (!duracion || p.noches === Number(duracion)) &&
      (!huespedes || (p.capacidad >= huespedes && (p.min_huespedes ?? 1) <= huespedes)) &&
      (!experiencia || p.experiencia === experiencia),
  );
  return (
    <>
      <div className="mb-10 grid gap-4 md:grid-cols-4">
        <label className="text-sm">
          Destino
          <select className={input} value={zona} onChange={(e) => setZona(e.target.value)}>
            <option value="">Todos</option>
            {[...new Set(q.data.map((p) => p.hotel.zona))].map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Duración
          <select className={input} value={duracion} onChange={(e) => setDuracion(e.target.value)}>
            <option value="">Todas</option>
            {[...new Set(q.data.map((p) => p.noches))]
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  {n} noches
                </option>
              ))}
          </select>
        </label>
        <label className="text-sm">
          Huéspedes
          <select
            className={input}
            value={huespedes}
            onChange={(e) => setHuespedes(Number(e.target.value))}
          >
            <option value={0}>Todos</option>
            {Array.from(
              { length: Math.max(0, ...q.data.map((p) => p.capacidad)) },
              (_, i) => i + 1,
            ).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Experiencia
          <select
            className={input}
            value={experiencia}
            onChange={(e) => setExperiencia(e.target.value)}
          >
            <option value="">Todas</option>
            {[...new Set(q.data.map((p) => p.experiencia))].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((p) => (
          <article key={p.id} className="rounded-[28px] bg-cream p-6 ring-1 ring-ink/10">
            <a href={`/paquete/${p.id}`} className="group block">
              <HotelCover
                image={p.hotel.imagen_url}
                name={p.nombre}
                ambient={p.hotel.imagen_ambiente}
              />
            </a>
            {p.destacado && (
              <p className="mt-4 text-xs font-bold uppercase text-accent">Destacado</p>
            )}
            <h3 className="mt-4 font-display text-2xl font-black">{p.nombre}</h3>
            <p className="mt-3 text-sm font-bold">{p.hotel.nombre}</p>
            <p className="mt-1 text-sm text-ink-soft">{p.hotel.ubicacion}</p>
            <p className="mt-4 text-sm">
              {p.noches + 1} días / {p.noches} noches ·{" "}
              {(p.min_huespedes ?? 1) === p.capacidad ? "para" : "hasta"} {p.capacidad} huéspedes
            </p>
            <p className="mt-3 text-sm">
              Alojamiento {p.tipo}
              {p.servicios.length
                ? ` · ${p.servicios
                    .slice(0, 3)
                    .map((s) => s.nombre)
                    .join(" · ")}`
                : ""}
            </p>
            <p className="mt-4 text-xl font-bold text-accent">{moneda(Number(p.precio))}</p>
            {p.precio_referencial != null && Number(p.precio_referencial) > Number(p.precio) && (
              <p className="text-sm text-ink-soft">
                <del>{moneda(Number(p.precio_referencial))}</del> · ahorro{" "}
                {moneda(Number(p.precio_referencial) - Number(p.precio))}
              </p>
            )}
            <a href={`/paquete/${p.id}`} className={`${button} mt-6 inline-block`}>
              Ver paquete
            </a>
          </article>
        ))}
        {!items.length && <p>No hay paquetes para estos filtros.</p>}
      </div>
    </>
  );
}
