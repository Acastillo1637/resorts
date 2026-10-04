export function authRedirect(
  origin: string,
  path: "/nueva-clave" | "/mi-cuenta" | "/mis-reservas",
) {
  const url = new URL(origin);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Origen de aplicación inválido.");
  return new URL(path, url.origin).href;
}
