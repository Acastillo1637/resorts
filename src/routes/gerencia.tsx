import { createFileRoute } from "@tanstack/react-router";
import { PanelGestion } from "@/components/gestion/PanelGestion";
export const Route = createFileRoute("/gerencia")({
  component: () => <PanelGestion rol="gerente" />,
});
