import { createClient } from "@supabase/supabase-js";
import { isPublicSupabaseKey } from "./public-config";

const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

// Las claves privadas jamás son credenciales válidas para un cliente web.
const publicKey = isPublicSupabaseKey(anonKey);
export const supabaseConfigured = Boolean(url && publicKey);
export const supabase = createClient(
  url || "https://example.supabase.co",
  publicKey ? anonKey! : "public-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  },
);

let recovery: { id: string; expires: number } | null = null;
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY" && session)
    recovery = { id: session.user.id, expires: Date.now() + 30 * 60_000 };
  if (event === "SIGNED_OUT") recovery = null;
});
export function recoveryAuthorized(id: string) {
  return recovery?.id === id && recovery.expires > Date.now();
}
