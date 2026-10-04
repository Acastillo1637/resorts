import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { validarNuevaClave } from "@/lib/account";
import { supabase, recoveryAuthorized } from "@/lib/supabase";
import { errorMensaje } from "@/lib/booking";
import { input, button } from "@/components/AppShell";
export const Route = createFileRoute("/nueva-clave")({ component: NuevaClave });
function NuevaClave() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState("Verificando enlace…");
  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => {
      window.location.assign("/acceso");
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [done]);
  useEffect(() => {
    let active = true;
    const accept = () => {
      if (active) {
        setReady(true);
        setMsg("");
      }
    };
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") accept();
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setMsg(errorMensaje(error));
      else if (data.session && recoveryAuthorized(data.session.user.id)) accept();
      else setMsg("El enlace venció o no es válido. Solicita otro enlace de recuperación.");
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return (
    <div className="min-h-screen bg-paper">
      <main className="mx-auto max-w-md px-6 py-20">
        <h1 className="font-display text-4xl font-black">Nueva contraseña</h1>
        {ready && !done && (
          <form
            className="mt-8 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              setMsg("");
              try {
                validarNuevaClave(password, repeat);
                const identity = await supabase.auth.getUser();
                if (
                  identity.error ||
                  !identity.data.user ||
                  !recoveryAuthorized(identity.data.user.id)
                )
                  throw new Error("El enlace venció. Solicita otro enlace.");
                const { error } = await supabase.auth.updateUser({ password });
                if (error) throw error;
                setPassword("");
                setRepeat("");
                const result = await supabase.auth.signOut();
                if (result.error) throw result.error;
                setDone(true);
                setMsg("Contraseña actualizada. Ya puedes iniciar sesión con tu nueva contraseña.");
              } catch (err) {
                setMsg(errorMensaje(err));
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            <label className="block">
              Contraseña (mínimo 8 caracteres)
              <input
                autoComplete="new-password"
                className={input}
                type="password"
                minLength={8}
                maxLength={128}
                disabled={busy}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="block">
              Repetir contraseña
              <input
                autoComplete="new-password"
                className={input}
                type="password"
                minLength={8}
                maxLength={128}
                disabled={busy}
                required
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
            </label>
            <button className={button} disabled={busy}>
              {busy ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}
        <p className="mt-6" role="status">
          {msg}
        </p>
        <a href={done ? "/acceso" : "/recuperar"} className="mt-6 block text-accent">
          {done ? "Ir al acceso" : "Solicitar otro enlace"}
        </a>
      </main>
    </div>
  );
}
