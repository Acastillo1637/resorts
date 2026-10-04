import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { errorMensaje } from "@/lib/booking";
export function Subscription() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg("");
        try {
          const { error } = await supabase.rpc("fn_suscribir", { p_email: email.trim() });
          if (error) throw error;
          setMsg("Tu correo quedó suscrito. Gracias por acompañarnos.");
          setEmail("");
        } catch (err) {
          setMsg(errorMensaje(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="relative">
        <input
          aria-label="Correo de suscripción"
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo electrónico"
          className="w-full border-b border-ink/10 bg-sand/40 py-3 pr-10 text-sm outline-none focus:border-accent"
        />
        <button
          aria-label="Suscribirse"
          disabled={busy}
          className="absolute right-0 top-1/2 -translate-y-1/2 text-lg text-accent hover:text-ink disabled:opacity-50"
        >
          {busy ? "…" : "→"}
        </button>
      </div>
      <label className="mt-4 flex gap-2 text-xs text-ink-soft">
        <input type="checkbox" required />
        Acepto recibir novedades y la{" "}
        <a href="/informacion/privacidad" className="underline">
          política de privacidad
        </a>
        .
      </label>
      <p className="mt-4 text-xs" role="status">
        {msg}
      </p>
    </form>
  );
}
