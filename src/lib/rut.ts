export function limpiarRut(value: string) {
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}
export function validarRut(value: string) {
  const r = limpiarRut(value);
  if (r.length < 8 || r.length > 9) return false;
  const cuerpo = r.slice(0, -1),
    dv = r.slice(-1);
  let suma = 0,
    m = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * m;
    m = m === 7 ? 2 : m + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
  return dv === esperado;
}
export function formatearRut(value: string) {
  const r = limpiarRut(value);
  if (r.length < 2) return r;
  return `${r.slice(0, -1)}-${r.slice(-1)}`;
}
