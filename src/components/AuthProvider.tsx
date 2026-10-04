import { useEffect, useState, useCallback, type ReactNode } from "react";
import { AuthContext } from "@/hooks/use-auth";
import { observeAuth, initialAuthState } from "@/lib/auth-observer";
import { cargarPerfil } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialAuthState);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((v) => v + 1), []);
  useEffect(() => observeAuth(supabase.auth, cargarPerfil, setState), [attempt]);
  return <AuthContext.Provider value={{ ...state, retry }}>{children}</AuthContext.Provider>;
}
