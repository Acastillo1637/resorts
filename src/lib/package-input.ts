export function formatoCLP(value: string) {
  return value.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
export function enteroPaquete(value: string, min = 0) {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min)
    throw new Error(
      "Revisa las cantidades y precios: usa solo enteros dentro de los límites indicados.",
    );
  return Number(value);
}
export function pegarCLP(value: string): string | null {
  return /^(\d+|\d{1,3}(\.\d{3})+)$/.test(value) ? value.replaceAll(".", "") : null;
}
