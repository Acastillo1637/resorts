import { createFileRoute } from "@tanstack/react-router";
import { PanelGestion } from "@/components/gestion/PanelGestion";
export const Route = createFileRoute("/recepcion")({
  component: () => <PanelGestion rol="recepcionista" />,
});
