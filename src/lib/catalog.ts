import { supabase } from "./supabase";
import type { Hotel } from "./hotels";
import type { Habitacion, Servicio } from "./booking";

const hotelImages: Record<string, string> = {
  "noi-casa-atacama": "/images/hoteles/noi-casa-atacama.jpg",
  "noi-vitacura": "/images/hoteles/noi-vitacura.jpg",
  "noi-puma-lodge": "/images/hoteles/noi-puma-lodge.jpg",
  "noi-blend-colchagua": "/images/hoteles/noi-blend-colchagua.jpg",
  "noi-indigo-patagonia": "/images/hoteles/noi-indigo-patagonia.jpg",
  "tierra-atacama": "/images/hoteles/tierra-atacama.webp",
  "tierra-patagonia": "/images/hoteles/tierra-patagonia.webp",
  "explora-atacama": "/images/hoteles/explora-atacama.jpg",
  "explora-torres-del-paine": "/images/hoteles/explora-torres-del-paine.jpg",
  "explora-rapa-nui": "/images/hoteles/explora-rapa-nui.jpg",
  "hotel-portillo": "/images/hoteles/hotel-portillo.jpg",
  "antumalal": "/images/hoteles/antumalal.jpg",
  "hotel-costa-real": "/images/hoteles/hotel-costa-real.jpg",
  "resort-las-condes": "/images/hoteles/hotel-lascondes.webp",
  "resort-puerto-varas": "/images/hoteles/puerto-varas.avif",
  "resort-santiago-centro": "/images/hoteles/resorts-santiago-centro.webp",
  "resort-vina-del-mar": "/images/hoteles/viña-del-mar.webp",
};

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

    console.log("HOTEL:", h["nombre"], "SLUG:", h["slug"]);

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
      image: hotelImages[String(h["slug"])] ?? String(h["imagen_url"] || ""),
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
