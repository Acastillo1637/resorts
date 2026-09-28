import { supabase } from "./supabase";
import type { Habitacion, HotelDB, Huesped, Reserva, Servicio } from "./booking";

// Paginar evita el límite por defecto de 1000 filas de PostgREST.
async function todas<T>(tabla: string, select = "*"): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from(tabla)
      .select(select)
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data as unknown as T[]));
    if (data.length < 500) return rows;
  }
}
export async function cargarGestion() {
  const [hoteles, habitaciones, huespedes, reservas, servicios, tipos, regiones] =
    await Promise.all([
      todas<HotelDB>("hoteles"),
      todas<Habitacion>("habitaciones"),
      todas<Huesped>("huespedes"),
      todas<Reserva>(
        "reservas",
        "*,perfiles(nombre,telefono),huespedes!reservas_huesped_id_fkey(*),pagos(*),servicios_contratados(*,servicios_adicionales(nombre))",
      ),
      todas<Servicio>("servicios_adicionales"),
      supabase.from("tipos_habitacion").select("*").order("nombre"),
      supabase.from("regiones").select("*").order("nombre"),
    ]);
  if (tipos.error) throw tipos.error;
  if (regiones.error) throw regiones.error;
  return {
    hoteles,
    habitaciones,
    huespedes,
    reservas,
    servicios,
    tipos: tipos.data as { codigo: string; nombre: string; descripcion: string }[],
    regiones: regiones.data as { id: string; nombre: string }[],
  };
}
export type Gestion = Awaited<ReturnType<typeof cargarGestion>>;
export async function rpc(nombre: string, params: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(nombre, params);
  if (error) throw error;
  return data;
}
export async function guardar(tabla: string, valores: Record<string, unknown>, id?: string) {
  const query = id
    ? supabase.from(tabla).update(valores).eq("id", id)
    : supabase.from(tabla).insert(valores);
  const { error } = await query;
  if (error) throw error;
}
