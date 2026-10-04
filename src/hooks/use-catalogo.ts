import { useQuery } from "@tanstack/react-query";
import { cargarCatalogo } from "@/lib/catalog";
export function useCatalogo() {
  return useQuery({ queryKey: ["catalogo"], queryFn: cargarCatalogo });
}
