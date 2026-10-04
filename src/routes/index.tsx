import { PublicSearch } from "@/components/PublicSearch";
import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { Catalog, Paquetes } from "@/components/Catalog";
import heroDusk from "@/assets/hero-dusk.jpg";
import textureRock from "@/assets/texture-rock.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Almond Resorts — Reservas de hoteles y residencias únicas" },
      {
        name: "description",
        content:
          "Curaduría de hoteles y residencias privadas en Chile. Encuentra tu refugio: busca por destino, fechas y huéspedes, y reserva en minutos.",
      },
      {
        property: "og:title",
        content: "Almond Resorts — Reservas de hoteles y residencias únicas",
      },
      {
        property: "og:description",
        content:
          "Curaduría de hoteles y residencias privadas en Chile. Reserva tu próxima escapada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-paper font-body text-ink antialiased">
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

      <section id="explorar" className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="mb-12 font-display text-5xl font-black tracking-tighter">Explorar</h2>
        <Paquetes />
      </section>
      <section id="destacados" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-16 border-b border-ink/10 pb-8">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-accent">
            Capítulo II
          </p>
          <h2 className="mt-4 font-display text-5xl font-black tracking-tighter">Destacados</h2>
        </div>
        <Catalog destacados />
      </section>
      {/* MANIFESTO */}
      <section id="hoteles" className="overflow-hidden bg-ink py-32 text-cream">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-24 px-6 lg:grid-cols-2">
          <div className="relative z-10">
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.5em] text-accent">
              Hoteles
            </span>
            <h2 className="mt-8 text-balance font-display text-6xl font-black leading-[0.8] tracking-tighter md:text-8xl">
              Observar el <span className="text-accent">silencio</span>.
            </h2>
            <p className="mt-12 max-w-lg text-xl leading-relaxed text-cream/50">
              Almond Resorts no es una agencia; es una curaduría de estados de ánimo traducidos en
              arquitectura. Espacios donde la luz de la tarde es el único evento.
            </p>
            <div className="mt-14 flex flex-wrap gap-6">
              <a
                href="/hoteles"
                className="rounded-full bg-accent px-10 py-5 text-[11px] font-black uppercase tracking-widest text-cream transition-all hover:bg-cream hover:text-ink"
              >
                Ver todos los hoteles
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
