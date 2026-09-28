import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { registrarCliente } from "@/lib/auth";
import { validarRut, formatearRut } from "@/lib/rut";
import { SiteHeader } from "@/components/SiteHeader";
import { input, button } from "@/components/AppShell";
export const Route = createFileRoute("/registro")({ component: Registro });
function Registro() {
  const nav = useNavigate();
  const [f, setF] = useState({ nombre: "", rut: "", telefono: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validarRut(f.rut)) {
      setError("Ingresa un RUT chileno válido.");
      return;
    }
    if (f.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setBusy(true);
    try {
      const resultado = await registrarCliente({ ...f, rut: formatearRut(f.rut) });
      if (resultado.requiereConfirmacion) {
        setError("Cuenta creada. Revisa tu correo para confirmar el acceso.");
      } else {
        await nav({ to: "/mi-cuenta" });
      }
    } catch (x) {
      setError(x instanceof Error ? x.message : "No se pudo crear la cuenta");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-6 py-16">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[.3em] text-accent">
          Nuevo huésped
        </p>
        <h1 className="mt-3 font-display text-5xl font-black tracking-tighter">Crea tu cuenta.</h1>
        <form onSubmit={submit} className="mt-10 grid gap-4 sm:grid-cols-2">
          <input
            className={`${input} sm:col-span-2`}
            placeholder="Nombre completo"
            value={f.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            required
          />
          <input
            className={input}
            placeholder="RUT"
            value={f.rut}
            onChange={(e) => set("rut", e.target.value)}
            required
          />
          <input
            className={input}
            placeholder="Teléfono"
            value={f.telefono}
            onChange={(e) => set("telefono", e.target.value)}
          />
          <input
            className={`${input} sm:col-span-2`}
            type="email"
            placeholder="Correo"
            value={f.email}
            onChange={(e) => set("email", e.target.value)}
            required
          />
          <input
            className={`${input} sm:col-span-2`}
            type="password"
            placeholder="Contraseña (mínimo 8 caracteres)"
            value={f.password}
            onChange={(e) => set("password", e.target.value)}
            required
          />
          {error && <p className="sm:col-span-2 text-sm text-red-700">{error}</p>}
          <button className={`${button} sm:col-span-2`} disabled={busy}>
            {busy ? "Creando…" : "Crear cuenta"}
          </button>
        </form>
        <p className="mt-6 text-sm text-ink-soft">
          ¿Ya tienes cuenta?{" "}
          <Link to="/acceso" className="font-bold text-accent">
            Ingresar
          </Link>
        </p>
      </main>
    </div>
  );
}
