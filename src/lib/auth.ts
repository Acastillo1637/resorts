import { supabase } from "./supabase";

export type Rol = "cliente" | "recepcionista" | "gerente";
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
  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error) return null;
  return data as Perfil;
}

export function rutaPorRol(rol: Rol) {
  return rol === "cliente" ? "/mi-cuenta" : rol === "recepcionista" ? "/recepcion" : "/gerencia";
}

export async function login(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const perfil = await getPerfil();
  if (!perfil) throw new Error("La cuenta no tiene un perfil asociado.");
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
      data: { rut: input.rut, nombre: input.nombre.trim(), telefono: input.telefono || null },
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Revisa tu correo para confirmar la cuenta.");
  return { user: data.user, requiereConfirmacion: !data.session };
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/";
}
