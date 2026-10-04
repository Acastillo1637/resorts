import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { Catalog } from "@/components/Catalog";
export const Route = createFileRoute("/hoteles")({
  validateSearch: (search: Record<string, unknown>) => ({
    zona: ["Desierto", "Litoral", "Patagonia", "Andes"].includes(String(search["zona"]))
      ? String(search["zona"])
      : "",
  }),
  head: () => ({ meta: [{ title: "Hoteles — Almond Resorts" }] }),
  component: Hoteles,
});
function Hoteles() {
  const { zona } = Route.useSearch();
  return (
    <div className="min-h-screen bg-paper">
      <main className="mx-auto max-w-7xl px-6 py-20">
        <h1 className="font-display text-5xl font-black tracking-tighter">
          Hoteles {zona && `· ${zona}`}
        </h1>
        <nav aria-label="Filtrar destino" className="my-10 flex flex-wrap gap-4">
          {["", "Desierto", "Litoral", "Patagonia", "Andes"].map((z) => (
            <a
              key={z}
              aria-current={zona === z ? "page" : undefined}
              href={`/hoteles${z ? `?zona=${encodeURIComponent(z)}` : ""}`}
              className={`rounded-full px-5 py-3 text-sm font-bold ${zona === z ? "bg-accent text-cream" : "bg-cream"}`}
            >
              {z || "Todos"}
            </a>
          ))}
        </nav>
        <Catalog zona={zona} />
      </main>
      <SiteFooter />
    </div>
  );
}
