import { createFileRoute, notFound } from "@tanstack/react-router";
import { cargarPaquetes } from "@/lib/catalog";
import { SiteFooter } from "@/components/SiteFooter";
import { HotelCover } from "@/components/HotelCover";
import { PackageBooking } from "@/components/PackageBooking";
import { moneda } from "@/lib/booking";
export const Route = createFileRoute("/paquete/$id")({
  loader: async ({ params }) => {
    const p = (await cargarPaquetes()).find((p) => p.id === params.id);
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.nombre ?? "Paquete"} — Almond Resorts` }],
  }),
  component: Detalle,
});
function Detalle() {
  const p = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-paper">
      <main className="mx-auto max-w-7xl px-6 py-14">
        <a href="/explorar" className="text-sm font-bold text-accent">
          ← Todos los paquetes
        </a>
        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <section>
            <HotelCover
              image={p.hotel.imagen_url}
              name={p.nombre}
              ambient={p.hotel.imagen_ambiente}
            />
            <h1 className="mt-8 font-display text-5xl font-black tracking-tighter">{p.nombre}</h1>
            <a href={`/hotel/${p.hotel.slug}`} className="mt-5 block font-bold text-accent">
              {p.hotel.nombre} · {p.hotel.ubicacion}
            </a>
            <p className="mt-5 text-lg text-ink-soft">{p.descripcion}</p>
            <p className="mt-5 font-bold">
              {p.noches + 1} días / {p.noches} noches · {p.tipo} ·{" "}
              hasta {p.capacidad} huéspedes
            </p>
            <p className="mt-4 text-2xl font-bold text-accent">
              {moneda(Number(p.precio))}
              {p.precio_referencial != null && Number(p.precio_referencial) > Number(p.precio) && (
                <del className="ml-4 text-base text-ink-soft">
                  {moneda(Number(p.precio_referencial))}
                </del>
              )}
            </p>
            <h2 className="mt-8 text-xl font-bold">Qué incluye</h2>
            <ul className="mt-3 space-y-2">
              <li>
                Alojamiento por {p.noches} noches en categoría {p.tipo}
              </li>
              {p.servicios.map((s) => (
                <li key={s.servicio_id}>
                  {s.nombre} × {s.cantidad}
                </li>
              ))}
            </ul>
            <h2 className="mt-8 text-xl font-bold">Condiciones</h2>
            <p className="mt-3 text-ink-soft">
              {p.condiciones ||
                "Sujeto a disponibilidad para las fechas y huéspedes seleccionados."}
            </p>
            <p className="mt-3 text-ink-soft">
              No incluye: {p.no_incluye || "servicios no enumerados en este paquete"}
            </p>
            {(p.vigente_desde || p.vigente_hasta) && (
              <p className="mt-3 text-sm">
                Vigencia de estancia: {p.vigente_desde || "desde hoy"} al{" "}
                {p.vigente_hasta || "sin fecha de término"}
              </p>
            )}
          </section>
          <aside>
            <PackageBooking paquete={p} />
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
