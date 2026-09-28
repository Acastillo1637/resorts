import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink/5 bg-paper/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="font-display text-2xl font-black leading-none tracking-tighter">
          Maremoto<span className="text-accent">.</span>
        </Link>
        <nav className="hidden items-center gap-10 text-[11px] font-bold uppercase tracking-[0.2em] text-ink/50 md:flex">
          <Link to="/" className="transition-colors hover:text-accent">
            Explorar
          </Link>
          <a href="/#hoteles" className="transition-colors hover:text-accent">
            Hoteles
          </a>
          <a href="/#manifiesto" className="transition-colors hover:text-accent">
            Manifiesto
          </a>
        </nav>
        <div className="flex items-center gap-6">
          <a
            href="/acceso"
            className="text-xs font-semibold uppercase tracking-widest transition-colors hover:text-accent"
          >
            Acceso
          </a>
          <a
            href="/#hoteles"
            className="rounded-full bg-accent px-7 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-cream transition-all hover:bg-ink active:scale-[0.96]"
          >
            Reservar
          </a>
        </div>
      </div>
    </header>
  );
}
