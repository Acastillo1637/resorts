import stayCuncumen from "@/assets/stay-cuncumen.jpg";
import stayHumo from "@/assets/stay-humo.jpg";
import stayAmatista from "@/assets/stay-amatista.jpg";

export interface Hotel {
  slug: string;
  name: string;
  location: string;
  pricePerNight: number;
  rating: number;
  reviews: number;
  image: string;
  tags: string[];
  description: string;
  amenities: string[];
  rooms: { name: string; detail: string; price: number }[];
}

export const hotels: Hotel[] = [
  {
    slug: "residencia-cuncumen",
    name: "Residencia Cúncumen",
    location: "Valle del Elqui, IV Región",
    pricePerNight: 210000,
    rating: 9.6,
    reviews: 128,
    image: stayCuncumen,
    tags: ["Privado", "Novedad"],
    description:
      "Una residencia brutalista suspendida sobre el valle, donde un ventanal circular enmarca el crepúsculo como una obra viva. Concreto, silencio y la luz violeta del Elqui.",
    amenities: [
      "Piscina temperada",
      "Wi-Fi",
      "Desayuno incluido",
      "Estacionamiento",
      "Terraza panorámica",
      "Tina exterior",
    ],
    rooms: [
      { name: "Habitación Circular", detail: "1 cama king · 2 huéspedes", price: 210000 },
      { name: "Suite del Valle", detail: "1 king · sala · 3 huéspedes", price: 285000 },
    ],
  },
  {
    slug: "modulo-humo",
    name: "Módulo Humo",
    location: "Chiloé, Archipiélago",
    pricePerNight: 165000,
    rating: 9.2,
    reviews: 96,
    image: stayHumo,
    tags: ["Bosque"],
    description:
      "Una cabaña de madera oscura entre coihues, con estufa a leña y ventanales que miran al lago. El refugio perfecto para desconectarse bajo el cielo violeta del sur.",
    amenities: ["Estufa a leña", "Wi-Fi", "Cocina equipada", "Kayaks", "Vista al lago"],
    rooms: [
      { name: "Cabaña Completa", detail: "1 queen + sofá cama · 3 huéspedes", price: 165000 },
    ],
  },
  {
    slug: "casa-amatista",
    name: "Casa Amatista",
    location: "Zapallar, Costa Central",
    pricePerNight: 320000,
    rating: 9.8,
    reviews: 64,
    image: stayAmatista,
    tags: ["Frente al mar"],
    description:
      "Pilares de piedra y una piscina infinita que se funde con el Pacífico al atardecer. Arquitectura minimalista frente al mar, pensada para la contemplación.",
    amenities: [
      "Piscina infinita",
      "Chef privado",
      "Wi-Fi",
      "Acceso a playa",
      "Spa",
      "Estacionamiento",
    ],
    rooms: [
      { name: "Suite Océano", detail: "1 cama king · 2 huéspedes", price: 320000 },
      { name: "Casa Completa", detail: "4 habitaciones · 8 huéspedes", price: 890000 },
    ],
  },
];

export function formatCLP(value: number): string {
  return "$" + value.toLocaleString("es-CL");
}
