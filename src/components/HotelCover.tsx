import { useState } from "react";
import heroDusk from "@/assets/hero-dusk.jpg";
export function HotelCover({
  image,
  name,
  ambient = false,
  className = "aspect-[16/10]",
}: {
  image?: string | undefined;
  name: string;
  ambient?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const fallback = !image || failed === image;
  return (
    <figure className={`relative overflow-hidden rounded-[28px] bg-sand ${className}`}>
      <img
        src={fallback ? heroDusk : image}
        alt={ambient || fallback ? `Portada de ambiente para ${name}` : name}
        onError={() => {
          if (!fallback) setFailed(image ?? "");
        }}
        className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105"
      />
      {(ambient || fallback) && (
        <figcaption className="absolute bottom-3 left-3 rounded-full bg-ink/80 px-3 py-1 text-xs text-cream">
          Imagen de ambiente
        </figcaption>
      )}
    </figure>
  );
}
