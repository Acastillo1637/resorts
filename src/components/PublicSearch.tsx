import { useState } from "react";
import { hotels } from "@/lib/hotels";
import { hoy, sumarDias } from "@/lib/booking";
export function PublicSearch() {
  const [hotel, setHotel] = useState(hotels[0]!.name);
  const [inicio, setInicio] = useState(hoy());
  const [fin, setFin] = useState(sumarDias(hoy(), 1));
  return (
    <form
      className="mt-8 grid gap-3 rounded-[24px] bg-cream p-4 text-ink md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        sessionStorage.setItem("maremoto-busqueda", JSON.stringify({ hotel, inicio, fin }));
        window.location.href = "/mi-cuenta";
      }}
    >
      <label className="text-xs font-bold">
        Destino
        <select
          className="mt-2 w-full bg-transparent p-2 text-sm"
          value={hotel}
          onChange={(e) => setHotel(e.target.value)}
        >
          {hotels.map((h) => (
            <option key={h.slug}>{h.name}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-bold">
        Entrada
        <input
          className="mt-2 w-full bg-transparent p-2 text-sm"
          type="date"
          min={hoy()}
          required
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
        />
      </label>
      <label className="text-xs font-bold">
        Salida
        <input
          className="mt-2 w-full bg-transparent p-2 text-sm"
          type="date"
          min={sumarDias(inicio || hoy(), 1)}
          required
          value={fin}
          onChange={(e) => setFin(e.target.value)}
        />
      </label>
      <button className="rounded-2xl bg-accent p-4 text-xs font-bold text-cream">
        Buscar disponibilidad
      </button>
    </form>
  );
}
