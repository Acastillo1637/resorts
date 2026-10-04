import { createContext, useContext } from "react";
import type { AuthState } from "@/lib/auth-observer";
export const AuthContext = createContext<(AuthState & { retry: () => void }) | null>(null);
export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error("AuthProvider requerido");
  return state;
}
