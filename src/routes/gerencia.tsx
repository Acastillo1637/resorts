import { createFileRoute } from "@tanstack/react-router";
import { PanelGestion } from "@/components/gestion/PanelGestion";
export const Route = createFileRoute("/gerencia")({
  validateSearch: (search: Record<string, unknown>): { accion?: "crear-paquete" } =>
    search["accion"] === "crear-paquete" ? { accion: "crear-paquete" } : {},
  component: Gerencia,
});
function Gerencia() {
  const { accion } = Route.useSearch();
  return <PanelGestion rol="gerente" crearPaquete={accion === "crear-paquete"} />;
}
