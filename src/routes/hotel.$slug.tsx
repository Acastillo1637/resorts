import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { BookingInquiry } from "@/components/BookingInquiry";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { hotels, formatCLP } from "@/lib/hotels";

export const Route = createFileRoute("/hotel/$slug")({
  loader: ({ params }) => {
    const hotel = hotels.find((h) => h.slug === params.slug);
    if (!hotel) throw notFound();
    return { hotel };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.hotel.name ?? "Hotel"} — Maremoto` },
      {
        name: "description",
        content: loaderData?.hotel.description ?? "Reserva tu estadía con Maremoto.",
      },
      { property: "og:title", content: `${loaderData?.hotel.name ?? "Hotel"} — Maremoto` },
      { property: "og:description", content: loaderData?.hotel.description ?? "" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HotelDetail,
});

function HotelDetail() {
  const { hotel } = Route.useLoaderData();
  const [roomIndex, setRoomIndex] = useState(0);
  const room = hotel.rooms[roomIndex] ?? hotel.rooms[0]!;
  return (
    <div className="min-h-screen overflow-x-hidden bg-paper font-body text-ink antialiased">
      <SiteHeader />

      <section className="mx-auto max-w-7xl px-6 py-14">
        <Link
          to="/"
          className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-ink-soft transition-colors hover:text-accent"
        >
          ← Volver a residencias
        </Link>

        <div className="mt-8 grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
          {/* GALLERY + INFO */}
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-[32px] bg-sand">
              <img
                src={hotel.image}
                alt={hotel.name}
                width={1200}
                height={752}
                className="aspect-[16/10] w-full object-cover"
              />
            </div>

            <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-accent">
                  {hotel.location}
                </p>
                <h1 className="mt-3 font-display text-5xl font-black tracking-tighter">
                  {hotel.name}
                </h1>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-cream px-4 py-2 ring-1 ring-ink/5">
                <span className="font-display text-xl font-black text-accent">
                  {hotel.rating.toFixed(1)}
                </span>
                <span className="text-xs font-medium text-ink-soft">· {hotel.reviews} reseñas</span>
              </div>
            </div>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
              {hotel.description}
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              {hotel.amenities.map((a) => (
                <span
                  key={a}
                  className="rounded-full bg-cream px-4 py-1.5 text-xs font-semibold text-ink/70 ring-1 ring-ink/10"
                >
                  {a}
                </span>
              ))}
            </div>

            <div className="mt-12">
              <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-ink-soft">
                Tipos de habitación
              </p>
              <div className="divide-y divide-ink/10 border-y border-ink/10">
                {hotel.rooms.map((r, i) => (
                  <button
                    key={r.name}
                    type="button"
                    onClick={() => setRoomIndex(i)}
                    className={`flex w-full items-center justify-between px-4 py-5 text-left transition-colors ${
                      i === roomIndex ? "bg-accent-soft/50" : "hover:bg-cream"
                    }`}
                  >
                    <div>
                      <p className="font-bold">{r.name}</p>
                      <p className="text-sm text-ink-soft">{r.detail}</p>
                    </div>
                    <p className="font-display text-lg font-black text-accent">
                      {formatCLP(r.price)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <BookingInquiry hotel={hotel.name} precio={room.price} />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
