import { PublicSearch } from "@/components/PublicSearch";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { hotels, formatCLP } from "@/lib/hotels";
import heroDusk from "@/assets/hero-dusk.jpg";
import textureRock from "@/assets/texture-rock.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maremoto — Reservas de hoteles y residencias únicas" },
      {
        name: "description",
        content:
          "Curaduría de hoteles y residencias privadas en Chile y Argentina. Encuentra tu refugio: busca por destino, fechas y huéspedes, y reserva en minutos.",
      },
      { property: "og:title", content: "Maremoto — Reservas de hoteles y residencias únicas" },
      {
        property: "og:description",
        content:
          "Curaduría de hoteles y residencias privadas en Chile y Argentina. Reserva tu próxima escapada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const featured = hotels[0]!;
  const rest = hotels.slice(1);

  return (
    <div className="min-h-screen overflow-x-hidden bg-paper font-body text-ink antialiased">
      <SiteHeader />

      {/* HERO */}
      <section className="relative mx-auto max-w-7xl px-6 pb-10 pt-10">
        <div className="relative min-h-[650px] overflow-hidden rounded-[40px] bg-sand md:min-h-[500px]">
          <img
            src={heroDusk}
            alt="Villa modernista en un acantilado al atardecer"
            className="absolute inset-0 h-full w-full object-cover"
            width={1920}
            height={1088}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-8 md:p-16">
            <div className="max-w-3xl text-cream">
              <p className="animate-rise font-mono text-[10px] uppercase tracking-[0.4em] text-cream/70">
                Reservas 2026 · Serie Violeta
              </p>
              <h1 className="animate-rise mt-6 text-balance font-display text-5xl font-black leading-[0.85] tracking-tighter [animation-delay:100ms] md:text-8xl">
                El refugio del crepúsculo.
              </h1>
            </div>

            {/* SEARCH */}
            <PublicSearch />
          </div>
        </div>
      </section>

      {/* HOTELS */}
      <section id="hoteles" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-16 flex items-end justify-between border-b border-ink/10 pb-8">
          <div className="max-w-xl">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-accent">
              Capítulo II
            </p>
            <h2 className="mt-4 font-display text-5xl font-black tracking-tighter">
              Arquitectura de la calma
            </h2>
          </div>
          <span className="hidden border-b-2 border-accent pb-2 text-[11px] font-black uppercase tracking-[0.2em] md:block">
            {hotels.length} residencias
          </span>
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <Link
            to="/hotel/$slug"
            params={{ slug: featured.slug }}
            className="group cursor-pointer md:col-span-7"
          >
            <div className="relative aspect-[16/10] overflow-hidden rounded-[32px] bg-sand">
              <img
                src={featured.image}
                alt={featured.name}
                loading="lazy"
                width={1200}
                height={752}
                className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105"
              />
              <div className="absolute left-8 top-8 flex gap-3">
                {featured.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-ink/90 px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-cream backdrop-blur"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-8 flex items-end justify-between">
              <div>
                <h3 className="font-display text-3xl font-extrabold tracking-tight">
                  {featured.name}
                </h3>
                <p className="mt-2 text-sm font-medium text-ink-soft">{featured.location}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-accent">
                  {formatCLP(featured.pricePerNight)}
                </p>
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-ink-soft">
                  CLP / Noche
                </p>
              </div>
            </div>
          </Link>

          <div className="flex flex-col gap-12 md:col-span-5">
            {rest.map((hotel) => (
              <Link
                key={hotel.slug}
                to="/hotel/$slug"
                params={{ slug: hotel.slug }}
                className="group cursor-pointer"
              >
                <div className="aspect-[4/3] overflow-hidden rounded-[28px] bg-sand">
                  <img
                    src={hotel.image}
                    alt={hotel.name}
                    loading="lazy"
                    width={944}
                    height={704}
                    className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  />
                </div>
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <h3 className="font-display text-xl font-extrabold tracking-tight">
                      {hotel.name}
                    </h3>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                      {hotel.location}
                    </p>
                  </div>
                  <p className="text-lg font-black text-accent">{formatCLP(hotel.pricePerNight)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* MANIFESTO */}
      <section id="manifiesto" className="overflow-hidden bg-ink py-32 text-cream">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-24 px-6 lg:grid-cols-2">
          <div className="relative z-10">
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.5em] text-accent">
              Pensamiento
            </span>
            <h2 className="mt-8 text-balance font-display text-6xl font-black leading-[0.8] tracking-tighter md:text-8xl">
              Observar el <span className="text-accent">silencio</span>.
            </h2>
            <p className="mt-12 max-w-lg text-xl leading-relaxed text-cream/50">
              Maremoto no es una agencia; es una curaduría de estados de ánimo traducidos en
              arquitectura. Espacios donde la luz de la tarde es el único evento.
            </p>
            <div className="mt-14 flex flex-wrap gap-6">
              <a
                href="/#hoteles"
                className="rounded-full bg-accent px-10 py-5 text-[11px] font-black uppercase tracking-widest text-cream transition-all hover:bg-cream hover:text-ink"
              >
                Ver residencias
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-20 rounded-full bg-accent/10 blur-[120px]" />
            <div className="relative skew-y-1 overflow-hidden rounded-[60px] border border-cream/10 shadow-2xl">
              <img
                src={textureRock}
                alt="Roca volcánica con escarcha"
                loading="lazy"
                width={1200}
                height={1408}
                className="aspect-[4/5] w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
