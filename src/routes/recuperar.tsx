import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { authRedirect } from "@/lib/auth-redirect";
import { supabase } from "@/lib/supabase";
import { errorMensaje } from "@/lib/booking";
import { input, button } from "@/components/AppShell";
export const Route = createFileRoute("/recuperar")({ component: Recuperar });
function Recuperar() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  return (
    <div className="min-h-screen bg-paper">
      <main className="mx-auto max-w-md px-6 py-20">
        <h1 className="font-display text-4xl font-black">Recuperar contraseña</h1>
        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (lock.current) return;
            lock.current = true;
            setBusy(true);
            setMsg("");
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: authRedirect(window.location.origin, "/nueva-clave"),
              });
              if (error) throw error;
              setMsg(
                "Si el correo corresponde a una cuenta, recibirás un enlace para establecer tu contraseña.",
              );
            } catch (err) {
              setMsg(errorMensaje(err));
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          <label className="block">
            Correo
            <input
              className={input}
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className={button} disabled={busy}>
            {busy ? "Enviando…" : "Enviar enlace"}
          </button>
          <p role="status">{msg}</p>
        </form>
        <a href="/acceso" className="mt-6 block text-accent">
          Volver al acceso
        </a>
      </main>
    </div>
  );
}
