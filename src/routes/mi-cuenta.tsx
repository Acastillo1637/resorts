import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { authRedirect } from "@/lib/auth-redirect";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { datosPerfilPermitidos, validarNuevaClave } from "@/lib/account";
import { rutaPorRol } from "@/lib/roles";
import { errorMensaje } from "@/lib/booking";
import { button, card, input } from "@/components/AppShell";

export const Route = createFileRoute("/mi-cuenta")({ component: MiCuenta });
function MiCuenta() {
  const auth = useAuth();
  const nav = useNavigate();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState("");
  const lock = useRef(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const identity = useQuery({
    queryKey: ["identidad", auth.session?.user.id],
    enabled: !!auth.session,
    queryFn: async () => {
      const result = await supabase.auth.getUser();
      if (result.error) throw result.error;
      if (!result.data.user || result.data.user.id !== auth.session?.user.id)
        throw new Error("Inicia sesión para continuar");
      return result.data.user;
    },
  });
  const user = identity.data ?? auth.session?.user;
  useEffect(() => {
    setEmail("");
    setPassword("");
    setPasswordRepeat("");
    setShowPassword(false);
    setMsg("");
    setError("");
  }, [auth.session?.user.id]);
  useEffect(() => {
    if (!auth.loading && !auth.session && !auth.error) void nav({ to: "/acceso" });
    if (auth.perfil && auth.perfil.rol !== "cliente") void nav({ to: rutaPorRol(auth.perfil.rol) });
  }, [auth.loading, auth.session, auth.error, auth.perfil, nav]);
  useEffect(() => {
    if (auth.perfil) {
      setNombre(auth.perfil.nombre);
      setTelefono(auth.perfil.telefono ?? "");
    }
  }, [auth.perfil]);
  async function perform(action: string, work: () => Promise<string>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(action);
    setMsg("");
    setError("");
    try {
      setMsg(await work());
    } catch (err) {
      setError(errorMensaje(err));
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  async function verificarIdentidad() {
    const result = await supabase.auth.getUser();
    if (result.error) throw result.error;
    if (!result.data.user || result.data.user.id !== auth.session?.user.id)
      throw new Error("Inicia sesión para continuar");
    if (auth.perfil?.rol !== "cliente") throw new Error("No autorizado");
    return result.data.user;
  }
  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-accent">
          Tu espacio personal
        </p>
        <h1 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-5xl">
          Mi cuenta
        </h1>
        {msg && (
          <p role="status" className="mt-6 rounded-2xl bg-accent-soft p-4 text-sm">
            {msg}
          </p>
        )}
        {(error || auth.error || identity.error) && (
          <p
            role="alert"
            className="mt-6 rounded-2xl border border-red-800/15 bg-red-50 p-4 text-sm text-red-800"
          >
            {error || auth.error || errorMensaje(identity.error)}
          </p>
        )}
        {auth.loading || !auth.session || auth.perfil?.rol !== "cliente" ? (
          <p role="status" className="mt-8">
            Verificando acceso…
          </p>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <section className={card}>
              <h2 className="font-display text-2xl font-bold">Datos personales</h2>
              {!auth.perfil ? (
                <div className="mt-5 space-y-4">
                  <p role="status">
                    {auth.profileLoading
                      ? "Cargando tus datos…"
                      : "Tu sesión está activa. Reintenta la carga de tus datos."}
                  </p>
                  <button className={button} disabled={auth.profileLoading} onClick={auth.retry}>
                    Reintentar
                  </button>
                </div>
              ) : (
                <form
                  className="mt-5 space-y-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void perform("perfil", async () => {
                      const current = await verificarIdentidad();
                      const values = datosPerfilPermitidos({ nombre, telefono });
                      const result = await supabase
                        .from("perfiles")
                        .update(values)
                        .eq("id", current.id)
                        .select("id")
                        .single();
                      if (result.error) throw result.error;
                      auth.retry();
                      return "Tus datos se guardaron correctamente.";
                    });
                  }}
                >
                  <label className="block text-sm font-semibold">
                    Nombre
                    <input
                      className={`${input} mt-2`}
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={150}
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      disabled={!!busy}
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Celular / teléfono
                    <input
                      className={`${input} mt-2`}
                      type="tel"
                      autoComplete="tel"
                      maxLength={30}
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      disabled={!!busy}
                      placeholder="+56 9 1234 5678"
                    />
                  </label>
                  <button className={button} disabled={!!busy}>
                    {busy === "perfil" ? "GUARDANDO…" : "GUARDAR DATOS"}
                  </button>
                </form>
              )}
            </section>
            <section className={card}>
              <h2 className="font-display text-2xl font-bold">Correo y acceso</h2>
              <p className="mt-5 text-sm text-ink-soft">Correo actual</p>
              <p className="mt-1 break-all font-semibold">{user?.email || "Consultando correo…"}</p>
              {user?.new_email && user.new_email !== user.email && (
                <p role="status" className="mt-3 rounded-xl bg-accent-soft p-3 text-sm">
                  Cambio pendiente a {user.new_email}. Confirma el enlace enviado a esa dirección;
                  Supabase puede solicitar también confirmar desde tu correo actual.
                </p>
              )}
              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform("email", async () => {
                    const current = await verificarIdentidad();
                    const next = email.trim();
                    if (next.toLowerCase() === current.email?.toLowerCase())
                      return "Ese ya es tu correo actual.";
                    const result = await supabase.auth.updateUser(
                      { email: next },
                      { emailRedirectTo: authRedirect(window.location.origin, "/mi-cuenta") },
                    );
                    if (result.error) throw result.error;
                    await identity.refetch();
                    setEmail("");
                    return result.data.user?.email?.toLowerCase() === next.toLowerCase() &&
                      !result.data.user?.new_email
                      ? "Tu correo se actualizó correctamente."
                      : "Cambio pendiente: confirma el enlace enviado al nuevo correo. Si Supabase solicita también confirmar desde tu dirección actual, completa ambos enlaces. Hasta entonces, sigue usando tu correo actual.";
                  });
                }}
              >
                <label className="block text-sm font-semibold">
                  Nuevo correo
                  <input
                    className={`${input} mt-2`}
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!!busy}
                  />
                </label>
                <p className="text-xs leading-relaxed text-ink-soft">
                  Supabase verifica la nueva dirección para proteger el acceso a tu cuenta.
                </p>
                <button className={button} disabled={!!busy}>
                  {busy === "email" ? "ENVIANDO…" : "CAMBIAR CORREO"}
                </button>
              </form>
              <div className="mt-6 border-t border-ink/10 pt-5">
                <h3 className="font-bold">Contraseña</h3>
                <form
                  className="mt-4 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void perform("password", async () => {
                      validarNuevaClave(password, passwordRepeat);
                      await verificarIdentidad();
                      const result = await supabase.auth.updateUser({ password });
                      if (result.error) throw result.error;
                      setPassword("");
                      setPasswordRepeat("");
                      setShowPassword(false);
                      return "Tu contraseña se actualizó correctamente.";
                    });
                  }}
                >
                  <label className="block text-sm font-semibold">
                    Nueva contraseña
                    <input
                      className={`${input} mt-2`}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={!!busy}
                      aria-describedby="password-hint"
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Confirmar nueva contraseña
                    <input
                      className={`${input} mt-2`}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      value={passwordRepeat}
                      onChange={(e) => setPasswordRepeat(e.target.value)}
                      disabled={!!busy}
                    />
                  </label>
                  <p id="password-hint" className="text-xs text-ink-soft">
                    Usa al menos 8 caracteres.
                  </p>
                  <button
                    type="button"
                    disabled={!!busy}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                    className="flex items-center gap-2 text-xs font-semibold text-accent disabled:opacity-50"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                    {showPassword ? "Ocultar contraseñas" : "Mostrar contraseñas"}
                  </button>
                  <button
                    type="submit"
                    className={button}
                    disabled={!!busy}
                    aria-busy={busy === "password"}
                  >
                    {busy === "password" ? "GUARDANDO…" : "GUARDAR CONTRASEÑA"}
                  </button>
                </form>
              </div>
            </section>
            <div className="flex flex-wrap items-center justify-between gap-4 md:col-span-2">
              <Link
                to="/mis-reservas"
                hash="mis-reservas"
                className="text-sm font-bold text-accent"
              >
                Ver mis reservas →
              </Link>
            </div>
          </div>
        )}
        {!auth.session && auth.error && (
          <button className={`${button} mt-6`} onClick={auth.retry}>
            Reintentar acceso
          </button>
        )}
      </main>
    </div>
  );
}
