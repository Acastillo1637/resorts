export type Estado = "pendiente" | "confirmada" | "check_in" | "check_out" | "cancelada";
export type EstadoVigente = Estado | "vencida";
export const estados: Record<EstadoVigente, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  check_in: "Alojado",
  check_out: "Checkout realizado",
  vencida: "Vencida · sin cierre operativo",
  cancelada: "Cancelada",
};
export const moneda = (value: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(value);
export function hoy() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function sumarDias(fecha: string, dias: number) {
  const d = new Date(fecha + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
export function noches(inicio: string, fin: string) {
  const valid = (v: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  if (!valid(inicio) || !valid(fin)) return 0;
  return Math.max(0, (Date.parse(fin) - Date.parse(inicio)) / 86400000);
}
export function superpone(inicio: string, fin: string, desde: string, hasta: string) {
  return inicio < hasta && fin > desde;
}
export function estadoVisible(r: { estado: Estado; estado_vigente?: EstadoVigente }) {
  return r.estado_vigente === "vencida" &&
    ["pendiente", "confirmada", "check_in"].includes(r.estado)
    ? "vencida"
    : r.estado;
}
export function filtrarReservas<
  T extends { estado: Estado; fecha_fin: string; estado_vigente?: EstadoVigente },
>(reservas: T[], filtro = "activas", fechaHoy = hoy()): T[] {
  return reservas.filter((r) => {
    const estado = estadoVisible(r);
    if (filtro === "activas")
      return ["pendiente", "confirmada", "check_in"].includes(estado) && r.fecha_fin >= fechaHoy;
    if (filtro === "historial") return ["vencida", "check_out", "cancelada"].includes(estado);
    if (filtro === "regularizacion") return estado === "vencida" && r.estado === "check_in";
    return !filtro || estado === filtro;
  });
}
export function validarEstancia(
  inicio: string,
  fin: string,
  adultos: number,
  ninos: number,
  capacidad: number,
  fechaHoy = hoy(),
) {
  if (!noches(inicio, fin) || inicio < fechaHoy)
    throw new Error("Selecciona entrada desde hoy y salida posterior.");
  if (
    !Number.isInteger(adultos) ||
    adultos < 1 ||
    !Number.isInteger(ninos) ||
    ninos < 0 ||
    adultos + ninos > capacidad
  )
    throw new Error("Revisa los huéspedes y la capacidad de la habitación.");
}
export function ocupacionPaquete(
  p: { capacidad: number; min_adultos: number; max_ninos: number; min_huespedes?: number },
  adultos: number,
  ninos: number,
) {
  return (
    Number.isInteger(adultos) &&
    Number.isInteger(ninos) &&
    adultos >= Math.max(1, p.min_adultos) &&
    ninos >= 0 &&
    ninos <= p.max_ninos &&
    adultos + ninos <= p.capacidad &&
    adultos + ninos >= (p.min_huespedes ?? 1)
  );
}
export function errorMensaje(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23P01")
    return "La habitación acaba de ocuparse para esas fechas. Busca otra disponible.";
  if (typeof error === "object" && error !== null) {
    const e = error as { code?: string; message?: string };
    const auth: Record<string, string> = {
      invalid_credentials: "Correo o contraseña incorrectos.",
      email_not_confirmed:
        "El acceso de esta cuenta aún no está habilitado. Contacta al equipo de Almond Resorts.",
      email_exists: "Ese correo ya está asociado a otra cuenta.",
      weak_password: "La contraseña no cumple los requisitos de seguridad.",
      same_password: "Elige una contraseña diferente a la actual.",
      reauthentication_needed:
        "Para cambiar la contraseña, vuelve a iniciar sesión e inténtalo nuevamente.",
      reauthentication_not_valid: "Vuelve a iniciar sesión para confirmar el cambio de contraseña.",
      otp_expired: "El enlace venció. Solicita otro enlace.",
      over_request_rate_limit: "Espera unos minutos e inténtalo nuevamente.",
    };
    if (e.code && auth[e.code]) return auth[e.code]!;
    const seguros = new Set([
      "Revisa las cantidades y precios: usa solo enteros dentro de los límites indicados.",
      "La estadía ya finalizó",
      "La reserva está vencida; requiere regularización",
      "No se pudo crear la cuenta. Inténtalo nuevamente.",
      "Inicia sesión para continuar",
      "Fechas inválidas: entrada desde hoy y salida posterior",
      "Huéspedes o estado inválidos",
      "Reserva no disponible",
      "La reserva cambió; actualiza la pantalla",
      "Habitación no disponible",
      "Se supera la capacidad de la habitación",
      "No autorizado para este hotel",
      "La edición debe conservar el hotel",
      "La reserva tiene varias facturas históricas; requiere conciliación antes de editar",
      "Selecciona un huésped",
      "Huésped inválido",
      "Registra el reembolso antes de reducir el total",
      "No autorizado",
      "Cambio de estado inválido",
      "Check-in fuera de las fechas de estancia",
      "Hay un saldo pendiente de pago",
      "Registra el reembolso antes de cancelar",
      "No autorizado",
      "La referencia de operación ya fue utilizada",
      "Monto o tipo inválido",
      "El importe supera el saldo permitido",
      "Reserva no disponible",
      "Servicio inválido para este hotel",
      "Inicia sesión",
      "Fechas inválidas",
      "Hay reservas activas incompatibles con el cambio de habitación",
      "La cuenta no tiene un perfil asociado.",
      "La habitación acaba de ocuparse. Selecciona otra disponible.",
      "El paquete cambió. Actualiza la ficha antes de reservar",
      "Paquete no disponible para estas fechas o huéspedes",
      "Revisa vigencia, huéspedes y servicios del paquete",
      "Habitación incompatible con el paquete",
      "Selecciona entrada desde hoy y salida posterior.",
      "Revisa los huéspedes y la capacidad de la habitación.",
      "El enlace venció. Solicita otro enlace.",
      "Gestión de paquetes restringida a gerencia del hotel",
      "No se puede cambiar el hotel de un paquete",
      "Revisa nombre, capacidad y vigencia",
      "El hotel no tiene esa categoría",
      "URL de portada inválida",
      "Los servicios deben estar activos y pertenecer al hotel",
      "Ingresa un nombre de entre 2 y 150 caracteres.",
      "La contraseña debe tener entre 8 y 128 caracteres.",
      "Las contraseñas no coinciden.",
      "Ingresa un teléfono válido, incluyendo el código de país si corresponde.",
    ]);
    if (e.message && seguros.has(e.message)) return e.message;
    if (e.code === "42501") return "No tienes permiso para realizar esta operación.";
    if (e.code === "23505") return "Ya existe un registro con esos datos.";
    if (e.code === "23514" || e.code === "23503")
      return "Revisa los datos y sus relaciones antes de guardar.";
  }
  return "No se pudo completar la operación. Inténtalo nuevamente.";
}
export interface HotelDB {
  id: string;
  nombre: string;
  region_id: string;
  direccion: string;
  descripcion: string;
  servicios: string[];
  estado: string;
  reservable?: boolean;
}
export interface Habitacion {
  id: string;
  hotel_id: string;
  numero: string;
  tipo: string;
  capacidad: number;
  precio_noche: number;
  estado: string;
  caracteristicas: string;
}
export interface Huesped {
  id: string;
  hotel_id: string;
  nombre: string;
  documento: string;
  email: string;
  telefono: string;
  notas: string;
}
export interface Servicio {
  id: string;
  hotel_id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  activo: boolean;
}
export interface Pago {
  id: string;
  monto: number;
  tipo: string;
  metodo: string;
  referencia: string;
  creado_en: string;
}
export interface Reserva {
  estado_registrado?: Estado;
  estado_vigente?: EstadoVigente;
  id: string;
  paquete_id?: string | null;
  paquete_precio_contratado?: number | null;
  paquete_snapshot?: {
    nombre: string;
    noches: number;
    precio: number;
    servicios: { nombre: string; cantidad: number }[];
  } | null;
  cliente_id: string | null;
  huesped_id: string | null;
  hotel_id: string;
  habitacion_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: Estado;
  adultos: number;
  ninos: number;
  tarifa_noche: number;
  version: number;
  notas: string;
  perfiles: { nombre: string; telefono: string | null } | null;
  huespedes: Huesped | null;
  pagos: Pago[];
  servicios_contratados: {
    id: string;
    cantidad: number;
    precio_unitario: number;
    incluido_paquete?: boolean;
    nombre_contratado?: string | null;
    servicios_adicionales: { nombre: string } | null;
  }[];
}
export function reservaVigente(r: Reserva): Reserva {
  return {
    ...r,
    estado_registrado: r.estado,
    estado: r.estado,
    pagos: r.pagos ?? [],
    servicios_contratados: r.servicios_contratados ?? [],
  };
}
export const titular = (r: Reserva) => r.huespedes?.nombre ?? r.perfiles?.nombre ?? "Huésped";
export const totalReserva = (r: Reserva) =>
  (r.paquete_precio_contratado != null
    ? Number(r.paquete_precio_contratado)
    : noches(r.fecha_inicio, r.fecha_fin) * Number(r.tarifa_noche)) +
  r.servicios_contratados.reduce(
    (n, s) =>
      n +
      (r.paquete_precio_contratado != null && s.incluido_paquete
        ? 0
        : s.cantidad * Number(s.precio_unitario)),
    0,
  );
export const pagado = (r: Reserva) =>
  r.pagos.reduce((n, p) => n + Number(p.monto) * (p.tipo === "pago" ? 1 : -1), 0);
