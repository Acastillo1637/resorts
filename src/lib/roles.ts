export type Rol = "cliente" | "recepcionista" | "gerente" | "gerente_general";
export function esGerencia(rol: Rol) {
  return rol === "gerente" || rol === "gerente_general";
}
export function accesoPanel(perfil: { rol: Rol; hotel_id: string | null } | null, panel: Rol) {
  if (!perfil) return false;
  if (perfil.rol === "gerente_general") return panel === "gerente" && perfil.hotel_id === null;
  return perfil.rol === panel && ["gerente", "recepcionista"].includes(panel) && !!perfil.hotel_id;
}
export function rutaPorRol(rol: Rol) {
  return rol === "cliente" ? "/mis-reservas" : rol === "recepcionista" ? "/recepcion" : "/gerencia";
}
export function navegacionRol(rol: Rol) {
  if (rol === "cliente")
    return {
      label: "MI CUENTA",
      links: [
        { to: "/mi-cuenta", label: "MI CUENTA" },
        { to: "/mis-reservas", label: "MIS RESERVAS" },
      ],
      paquete: false,
      reservar: true,
    } as const;
  return {
    label: rol === "recepcionista" ? "GESTIÓN DE ESTADÍAS" : "GERENCIA",
    links: [
      {
        to: rol === "recepcionista" ? "/recepcion" : "/gerencia",
        label: rol === "recepcionista" ? "GESTIÓN DE ESTADÍAS" : "GESTIÓN",
      },
    ],
    paquete: esGerencia(rol),
    reservar: false,
  } as const;
}
export function accesoReserva(perfil: { rol: Rol; hotel_id: string | null } | null, hotel: string) {
  return (
    !!perfil &&
    ((perfil.rol === "gerente_general" && perfil.hotel_id === null) ||
      (["gerente", "recepcionista"].includes(perfil.rol) &&
        !!perfil.hotel_id &&
        perfil.hotel_id === hotel))
  );
}
