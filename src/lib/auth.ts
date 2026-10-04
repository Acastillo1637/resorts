import { supabase } from "./supabase";
import { authRedirect } from "./auth-redirect";

export type { Rol } from "./roles";
export { rutaPorRol } from "./roles";
import type { Rol } from "./roles";
export interface Perfil {
  id: string;
  rut: string;
  nombre: string;
  rol: Rol;
  hotel_id: string | null;
  telefono: string | null;
}

export async function getPerfil(): Promise<Perfil | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  return cargarPerfil(session.user.id);
}
export async function cargarPerfil(id: string): Promise<Perfil | null> {
  const { data, error } = await supabase.from("perfiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Perfil;
}

export async function login(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const perfil = await getPerfil();
  if (!perfil) {
    throw new Error("La cuenta no tiene un perfil asociado.");
  }
  return perfil;
}

export async function registrarCliente(input: {
  email: string;
  password: string;
  rut: string;
  nombre: string;
  telefono?: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: authRedirect(window.location.origin, "/mis-reservas"),
      data: { rut: input.rut, nombre: input.nombre.trim(), telefono: input.telefono || null },
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error("No se pudo crear la cuenta. Inténtalo nuevamente.");
  return { user: data.user, requiereConfirmacion: !data.session };
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.href = "/";
}
