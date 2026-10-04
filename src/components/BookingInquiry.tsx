import { useState } from "react";
import { hoy, moneda, noches, sumarDias } from "@/lib/booking";
export function BookingInquiry({
  hotel,
  hotelId,
  habitacionId,
  precio,
}: {
  hotel: string;
  hotelId: string;
  habitacionId?: string | undefined;
  precio: number;
}) {
  const [inicio, setInicio] = useState(hoy());
  const [fin, setFin] = useState(sumarDias(hoy(), 1));
  return (
    <form
      className="space-y-5 rounded-[28px] bg-ink p-8 text-cream"
      onSubmit={(e) => {
        e.preventDefault();
        sessionStorage.setItem(
          "maremoto-busqueda",
          JSON.stringify({ hotel, hotelId, habitacionId, inicio, fin }),
        );
        window.location.href = "/mis-reservas";
      }}
    >
      <h2 className="font-display text-2xl font-black">Planifica tu estadía</h2>
      <p className="text-sm text-cream/70">
        Consulta la disponibilidad y la tarifa vigente en tu cuenta.
      </p>
      <label className="block text-sm">
        Entrada
        <input
          className="mt-2 w-full rounded-xl border border-cream/20 bg-cream/10 p-3 [color-scheme:dark]"
          type="date"
          required
          min={hoy()}
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Salida
        <input
          className="mt-2 w-full rounded-xl border border-cream/20 bg-cream/10 p-3 [color-scheme:dark]"
          type="date"
          required
          min={sumarDias(inicio || hoy(), 1)}
          value={fin}
          onChange={(e) => setFin(e.target.value)}
        />
      </label>
      <p>
        {noches(inicio, fin)} noches · Precio orientativo: {moneda(noches(inicio, fin) * precio)}
      </p>
      <button
        className="w-full rounded-2xl bg-accent px-5 py-4 text-sm font-bold"
        disabled={!noches(inicio, fin)}
      >
        Consultar y reservar
      </button>
      <p className="text-xs text-cream/60">
        La reserva se confirma en el portal una vez verificada la disponibilidad.
      </p>
    </form>
  );
}
