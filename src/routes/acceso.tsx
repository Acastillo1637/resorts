import { errorMensaje } from "@/lib/booking";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { login, rutaPorRol } from "@/lib/auth";
import { input, button } from "@/components/AppShell";
import { supabaseConfigured } from "@/lib/supabase";
export const Route = createFileRoute("/acceso")({ component: Acceso });
function Acceso() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const p = await login(email, password);
      await nav({ to: rutaPorRol(p.rol) } as never);
    } catch (x) {
      setError(errorMensaje(x));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-paper">
      <main className="mx-auto max-w-md px-6 py-20">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[.3em] text-accent">
          Cuenta Almond Resorts
        </p>
        <h1 className="mt-3 font-display text-5xl font-black tracking-tighter">Bienvenido.</h1>
        <p className="mt-4 text-ink-soft">Accede a tus reservas o al panel de operación.</p>
        {!supabaseConfigured && (
          <p className="mt-6 rounded-2xl bg-accent-soft p-4 text-sm">
            El acceso no está disponible en este momento. Inténtalo más tarde.
          </p>
        )}
        <form onSubmit={submit} className="mt-10 space-y-4">
          <input
            className={input}
            type="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className={input}
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className={`${button} w-full`} disabled={busy}>
            {busy ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
        <a href="/recuperar" className="mt-5 block text-center text-sm font-bold text-accent">
          ¿Olvidaste tu contraseña?
        </a>
        <p className="mt-7 text-center text-sm text-ink-soft">
          ¿Primera vez?{" "}
          <Link to="/registro" className="font-bold text-accent">
            Crear cuenta
          </Link>
        </p>
      </main>
    </div>
  );
}
