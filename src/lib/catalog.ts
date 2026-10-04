import { supabase } from "./supabase";
import type { Hotel } from "./hotels";
import type { Habitacion, Servicio } from "./booking";

export interface CatalogHotel extends Hotel {
  id: string;
  zona: string;
  destacado: boolean;
  fuente: string;
  reservable: boolean;
  inventarioDemo: boolean;
  imagenAmbiente: boolean;
  habitaciones: Habitacion[];
  servicios: Servicio[];
}
export interface Paquete {
  id: string;
  hotel_id: string;
  nombre: string;
  descripcion: string;
  noches: number;
  tipo: string;
  precio: number;
  version: number;
  precio_referencial: number | null;
  imagen_url: string;
  destacado: boolean;
  experiencia: string;
  capacidad: number;
  min_huespedes?: number;
  min_adultos: number;
  max_ninos: number;
  condiciones: string;
  no_incluye: string;
  vigente_desde: string | null;
  vigente_hasta: string | null;
  hotel: {
    nombre: string;
    ubicacion: string;
    zona: string;
    slug: string;
    imagen_url: string;
    imagen_ambiente: boolean;
    inventario_demo: boolean;
  };
  servicios: { servicio_id: string; cantidad: number; nombre: string }[];
}
export async function cargarCatalogo(): Promise<CatalogHotel[]> {
  const { data, error } = await supabase.rpc("fn_catalogo_publico");
  if (error) throw error;
  return (data ?? []).map((h: Record<string, unknown>) => {
    const habitaciones = h["habitaciones"] as Habitacion[];
    const servicios = h["servicios"] as Servicio[];
    return {
      id: String(h["id"]),
      slug: String(h["slug"]),
      name: String(h["nombre"]),
      location: String(h["direccion"]),
      description: String(h["descripcion"]),
      zona: String(h["zona"]),
      destacado: Boolean(h["destacado"]),
      fuente: /^https:\/\//i.test(String(h["fuente_url"] || "")) ? String(h["fuente_url"]) : "",
      reservable: Boolean(h["reservable"]),
      inventarioDemo: Boolean(h["inventario_demo"]),
      imagenAmbiente: Boolean(h["imagen_ambiente"]),
      image: String(h["imagen_url"] || ""),
      pricePerNight: Math.min(...habitaciones.map((r) => Number(r.precio_noche))),
      rating: 0,
      reviews: 0,
      tags: [String(h["zona"])],
      amenities: servicios.map((s) => s.nombre),
      rooms: habitaciones.map((r) => ({
        id: r.id,
        name: r.caracteristicas || r.tipo,
        detail: `${r.capacidad} huéspedes`,
        price: Number(r.precio_noche),
      })),
      habitaciones,
      servicios,
    };
  });
}
export async function cargarPaquetes(): Promise<Paquete[]> {
  const { data, error } = await supabase.rpc("fn_paquetes_publicos");
  if (error) throw error;
  return data ?? [];
}
