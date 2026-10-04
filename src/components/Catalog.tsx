import { type CatalogHotel } from "@/lib/catalog";
import { useCatalogo } from "@/hooks/use-catalogo";
import { errorMensaje, moneda } from "@/lib/booking";
import { button } from "./AppShell";
import { HotelCover } from "./HotelCover";
export function HotelCard({ hotel }: { hotel: CatalogHotel }) {
  return (
    <a href={`/hotel/${hotel.slug}`} className="group block">
      <HotelCover image={hotel.image} name={hotel.name} ambient={hotel.imagenAmbiente} />
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl font-black">{hotel.name}</h3>
          <p className="mt-2 text-sm text-ink-soft">{hotel.location}</p>
        </div>
        <p className="font-bold text-accent">
          {Number.isFinite(hotel.pricePerNight)
            ? `Desde ${moneda(hotel.pricePerNight)}`
            : "Consultar tarifa"}
        </p>
      </div>
      {!hotel.reservable && (
        <p className="mt-2 text-xs text-ink-soft">Tarifa referencial · inventario por validar</p>
      )}
    </a>
  );
}
export function Catalog({
  zona = "",
  destacados = false,
}: {
  zona?: string;
  destacados?: boolean;
}) {
  const q = useCatalogo();
  if (q.isPending) return <p role="status">Cargando hoteles…</p>;
  if (q.error)
    return (
      <div role="alert">
        <p>{errorMensaje(q.error)}</p>
        <button className={button} onClick={() => q.refetch()}>
          Reintentar
        </button>
      </div>
    );
  const hoteles = q.data.filter((h) => (!zona || h.zona === zona) && (!destacados || h.destacado));
  if (destacados && hoteles.length)
    return (
      <div className="grid items-start gap-10 md:grid-cols-12">
        <div className="md:col-span-7">
          <HotelCard hotel={hoteles[0]!} />
        </div>
        <div className="flex flex-col gap-12 md:col-span-5">
          {hoteles.slice(1).map((h) => (
            <HotelCard key={h.id} hotel={h} />
          ))}
        </div>
      </div>
    );
  return (
    <div
      className={
        destacados
          ? "grid items-start gap-10 md:grid-cols-2"
          : "grid gap-10 md:grid-cols-2 lg:grid-cols-3"
      }
    >
      {hoteles.map((h) => (
        <HotelCard key={h.id} hotel={h} />
      ))}
      {!hoteles.length && <p>No hay hoteles publicados para este filtro.</p>}
    </div>
  );
}
export { PackageCatalog as Paquetes } from "./PackageCatalog";
