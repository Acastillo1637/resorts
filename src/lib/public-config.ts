export function isPublicSupabaseKey(key: string | undefined): boolean {
  if (!key) return false;
  if (key.startsWith("sb_publishable_")) return true;
  try {
    const payload = key.split(".")[1];
    return (
      !!payload && JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).role === "anon"
    );
  } catch {
    return false;
  }
}
export function validatePublicEnvironment(values: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(values)) {
    if (!name.startsWith("VITE_") || !value) continue;
    if (
      /SERVICE_ROLE|SECRET|PRIVATE|PASSWORD|DATABASE_URL/i.test(name) ||
      value.startsWith("sb_secret_") ||
      (name === "VITE_SUPABASE_ANON_KEY" && !isPublicSupabaseKey(value))
    )
      throw new Error(
        "Configuración pública inválida: retira las credenciales privadas antes de compilar.",
      );
    let role: unknown;
    try {
      const payload = value.split(".")[1];
      if (payload) role = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).role;
    } catch {
      /* Un valor público no necesariamente es un JWT. */
    }
    if (role === "service_role") throw new Error("Credencial privada en la configuración pública.");
  }
}
