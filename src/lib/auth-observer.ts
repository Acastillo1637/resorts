import type { Session, AuthChangeEvent } from "@supabase/supabase-js";
import type { Perfil } from "./auth";

export interface AuthState {
  session: Session | null;
  perfil: Perfil | null;
  loading: boolean;
  profileLoading: boolean;
  error: string;
}
export const initialAuthState: AuthState = {
  session: null,
  perfil: null,
  loading: true,
  profileLoading: false,
  error: "",
};
interface AuthSource {
  getSession: () => Promise<{ data: { session: Session | null }; error: unknown }>;
  onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
    data: { subscription: { unsubscribe: () => void } };
  };
}
// Una respuesta antigua de perfil/sesión nunca puede restaurar una sesión cerrada.
export function observeAuth(
  source: AuthSource,
  load: (id: string) => Promise<Perfil | null>,
  publish: (state: AuthState) => void,
) {
  let active = true;
  let revision = 0;
  let snapshot = initialAuthState;
  function emit(state: AuthState) {
    snapshot = state;
    publish(state);
  }
  const timers = new Set<ReturnType<typeof setTimeout>>();
  function receive(session: Session | null) {
    const current = ++revision;
    emit({ session, perfil: null, loading: false, profileLoading: !!session, error: "" });
    if (!session) return;
    // No llamar Auth ni esperar consultas dentro del callback de Auth.
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!active || current !== revision) return;
      void load(session.user.id)
        .then((perfil) => {
          if (active && current === revision)
            emit({
              session,
              perfil,
              loading: false,
              profileLoading: false,
              error: perfil ? "" : "No se pudo cargar tu perfil. Tu sesión sigue activa.",
            });
        })
        .catch(() => {
          if (active && current === revision)
            emit({
              session,
              perfil: null,
              loading: false,
              profileLoading: false,
              error: "No se pudo cargar tu perfil. Tu sesión sigue activa.",
            });
        });
    }, 0);
    timers.add(timer);
  }
  const { data } = source.onAuthStateChange((event, session) => {
    if (!active) return;
    if (
      (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") &&
      session &&
      snapshot.perfil &&
      snapshot.session?.user.id === session.user.id
    ) {
      revision++;
      emit({ ...snapshot, session });
    } else receive(session);
  });
  const current = revision;
  void source
    .getSession()
    .then(({ data, error }) => {
      if (!active || revision !== current) return;
      if (error) throw error;
      receive(data.session);
    })
    .catch(() => {
      if (active && revision === current)
        emit({
          ...initialAuthState,
          loading: false,
          error: "No se pudo comprobar la sesión. Inténtalo nuevamente.",
        });
    });
  return () => {
    active = false;
    revision++;
    data.subscription.unsubscribe();
    timers.forEach(clearTimeout);
  };
}
