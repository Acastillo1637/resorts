import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { Paquetes } from "@/components/Catalog";
export const Route = createFileRoute("/explorar")({
  head: () => ({ meta: [{ title: "Explorar paquetes — Almond Resorts" }] }),
  component: Explorar,
});
function Explorar() {
  return (
    <div className="min-h-screen bg-paper">
      <main className="mx-auto max-w-7xl px-6 py-20">
        <h1 className="mb-12 font-display text-5xl font-black tracking-tighter">
          Explorar paquetes
        </h1>
        <Paquetes />
      </main>
      <SiteFooter />
    </div>
  );
}
