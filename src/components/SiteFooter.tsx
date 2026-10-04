import { Subscription } from "./Subscription";
export function SiteFooter() {
  return (
    <footer className="border-t border-ink/5 bg-paper pt-24 pb-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 gap-16 md:grid-cols-12">
          <div className="col-span-2 md:col-span-5">
            <p className="font-display text-4xl font-black tracking-tighter">
              Almond Resorts<span className="text-accent">.</span>
            </p>
            <p className="mt-8 max-w-sm text-sm font-medium leading-relaxed text-ink-soft">
              Exploramos la intersección entre el paisaje y la estructura. Curaduría de residencias
              privadas en Chile.
            </p>
          </div>

          <div className="col-span-1 md:col-span-2">
            <p className="mb-8 font-mono text-[9px] font-black uppercase tracking-[0.3em] text-accent">
              Destinos
            </p>
            <ul className="space-y-4 text-xs font-bold uppercase tracking-widest text-ink/60">
              <li>
                <a href="/hoteles?zona=Desierto" className="transition-colors hover:text-accent">
                  Desierto
                </a>
              </li>
              <li>
                <a href="/hoteles?zona=Litoral" className="transition-colors hover:text-accent">
                  Litoral
                </a>
              </li>
              <li>
                <a href="/hoteles?zona=Patagonia" className="transition-colors hover:text-accent">
                  Patagonia
                </a>
              </li>
              <li>
                <a href="/hoteles?zona=Andes" className="transition-colors hover:text-accent">
                  Andes
                </a>
              </li>
            </ul>
          </div>

          <div className="col-span-1 md:col-span-2">
            <p className="mb-8 font-mono text-[9px] font-black uppercase tracking-[0.3em] text-accent">
              Servicios
            </p>
            <ul className="space-y-4 text-xs font-bold uppercase tracking-widest text-ink/60">
              <li>
                <a href="/informacion/membresia" className="transition-colors hover:text-accent">
                  Membresía
                </a>
              </li>
              <li>
                <a href="/informacion/arquitectos" className="transition-colors hover:text-accent">
                  Arquitectos
                </a>
              </li>
              <li>
                <a href="/informacion/eventos" className="transition-colors hover:text-accent">
                  Eventos
                </a>
              </li>
            </ul>
          </div>

          <div className="col-span-2 md:col-span-3">
            <p className="mb-8 font-mono text-[9px] font-black uppercase tracking-[0.3em] text-accent">
              Suscripción
            </p>
            <Subscription />
            <p className="mt-4 text-[10px] uppercase leading-tight tracking-tighter text-ink-soft">
              Únete a nuestra lista de espera para aperturas exclusivas.
            </p>
          </div>
        </div>

        <div className="mt-24 flex flex-col items-center justify-between gap-6 border-t border-ink/5 pt-10 md:flex-row">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-soft">
            © 2026 Almond Resorts — Chile.
          </p>
          <div className="flex gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-ink/40">
            <a href="/informacion/privacidad" className="transition-colors hover:text-accent">
              Privacidad
            </a>
            <a href="/informacion/terminos" className="transition-colors hover:text-accent">
              Términos
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
