import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { logout, type Perfil } from "@/lib/auth";

export function AppShell({
  perfil,
  title,
  eyebrow,
  children,
}: {
  perfil: Perfil;
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper font-body text-ink">
      <header className="border-b border-ink/10 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="font-display text-2xl font-black tracking-tighter">
            Maremoto<span className="text-accent">.</span>
          </Link>
          <div className="flex items-center gap-5">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold">{perfil.nombre}</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-ink-soft">
                {perfil.rol}
              </p>
            </div>
            <button
              onClick={logout}
              className="rounded-full border border-ink/15 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-ink hover:text-cream"
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-12">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[.3em] text-accent">
          {eyebrow}
        </p>
        <h1 className="mt-3 font-display text-5xl font-black tracking-tighter">{title}</h1>
        <div className="mt-10">{children}</div>
      </main>
    </div>
  );
}

export const card = "rounded-[28px] bg-cream p-6 ring-1 ring-ink/10";
export const input =
  "w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm outline-none focus:border-accent";
export const button =
  "rounded-2xl bg-accent px-5 py-3 text-[10px] font-black uppercase tracking-widest text-cream transition hover:bg-ink disabled:opacity-50";
