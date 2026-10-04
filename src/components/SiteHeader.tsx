import { Link, useLocation } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { logout } from "@/lib/auth";
import { navegacionRol } from "@/lib/roles";

export function SiteHeader() {
  const auth = useAuth();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const navigation = auth.perfil ? navegacionRol(auth.perfil.rol) : null;
  async function cerrarSesion() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await logout();
    } catch {
      setError("No se pudo cerrar la sesión. Inténtalo nuevamente.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <header className="sticky top-0 z-50 border-b border-ink/5 bg-paper/85 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3">
        <Link
          to="/"
          className="font-display text-xl font-black leading-none tracking-tighter sm:text-2xl"
        >
          Almond Resorts<span className="text-accent">.</span>
        </Link>
        <nav className="hidden items-center gap-10 text-[11px] font-bold uppercase tracking-[0.2em] text-ink/50 lg:flex">
          <a href="/explorar" className="transition-colors hover:text-accent">
            Explorar
          </a>
          <a href="/#destacados" className="transition-colors hover:text-accent">
            Destacados
          </a>
          <a href="/hoteles" className="transition-colors hover:text-accent">
            Hoteles
          </a>
        </nav>
        <div className="flex w-full items-center justify-end gap-4 sm:w-auto sm:gap-6">
          {auth.loading || (auth.session && auth.profileLoading) ? (
            <span
              role="status"
              aria-label="Verificando sesión"
              className="h-4 w-24 animate-pulse rounded-full bg-ink/10"
            />
          ) : !auth.session && auth.error ? (
            <button onClick={auth.retry} className="text-xs font-semibold text-accent">
              Reintentar acceso
            </button>
          ) : auth.session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={busy}
                  className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:opacity-50 sm:text-xs"
                >
                  {busy ? "Cerrando sesión…" : (navigation?.label ?? "SESIÓN")}
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={12}
                className="w-56 rounded-2xl border-ink/10 bg-paper p-2 text-ink shadow-xl"
              >
                {navigation?.links.map(({ to, label }) => (
                  <DropdownMenuItem
                    key={to}
                    asChild
                    className={`rounded-xl px-4 py-3 text-[10px] font-bold tracking-widest focus:bg-accent-soft focus:text-accent ${pathname === to ? "bg-accent-soft text-accent" : ""}`}
                  >
                    <Link to={to} aria-current={pathname === to ? "page" : undefined}>
                      {label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-ink/10" />
                <DropdownMenuItem
                  disabled={busy}
                  onSelect={() => void cerrarSesion()}
                  className="rounded-xl px-4 py-3 text-[10px] font-bold tracking-widest text-accent focus:bg-accent-soft focus:text-accent"
                >
                  CERRAR SESIÓN
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/acceso"
              className="text-[10px] font-semibold uppercase tracking-widest transition-colors hover:text-accent sm:text-xs"
            >
              Acceso
            </Link>
          )}
          {navigation?.paquete ? (
            <Link
              to="/gerencia"
              search={{ accion: "crear-paquete" }}
              className="rounded-full bg-accent px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-cream hover:bg-ink sm:px-7"
            >
              CREAR PAQUETE
            </Link>
          ) : (
            (!auth.session || navigation?.reservar) &&
            !auth.loading && (
              <a
                href="/hoteles"
                className="rounded-full bg-accent px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-cream transition-all hover:bg-ink active:scale-[0.96] sm:px-7 sm:text-[11px]"
              >
                Reservar
              </a>
            )
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mx-auto max-w-7xl px-6 pb-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <nav
        aria-label="Navegación principal"
        className="flex justify-center gap-8 border-t border-ink/5 py-3 text-[10px] font-bold uppercase tracking-widest lg:hidden"
      >
        <a href="/explorar">Explorar</a>
        <a href="/#destacados">Destacados</a>
        <a href="/hoteles">Hoteles</a>
      </nav>
    </header>
  );
}
