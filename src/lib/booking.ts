export type Estado = "pendiente" | "confirmada" | "check_in" | "check_out" | "cancelada";
export const estados: Record<Estado, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  check_in: "Alojado",
  check_out: "Finalizada",
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
export function errorMensaje(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23P01")
    return "La habitación acaba de ocuparse para esas fechas. Busca otra disponible.";
  if (typeof error === "object" && error !== null && "message" in error)
    return String(error.message);
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
  id: string;
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
    servicios_adicionales: { nombre: string } | null;
  }[];
}
export const titular = (r: Reserva) => r.huespedes?.nombre ?? r.perfiles?.nombre ?? "Huésped";
export const totalReserva = (r: Reserva) =>
  noches(r.fecha_inicio, r.fecha_fin) * Number(r.tarifa_noche) +
  r.servicios_contratados.reduce((n, s) => n + s.cantidad * Number(s.precio_unitario), 0);
export const pagado = (r: Reserva) =>
  r.pagos.reduce((n, p) => n + Number(p.monto) * (p.tipo === "pago" ? 1 : -1), 0);
