export function datosPerfilPermitidos(input: Record<string, unknown>) {
  const nombre = typeof input["nombre"] === "string" ? input["nombre"].trim() : "";
  const telefono = typeof input["telefono"] === "string" ? input["telefono"].trim() : "";
  if (nombre.length < 2 || nombre.length > 150)
    throw new Error("Ingresa un nombre de entre 2 y 150 caracteres.");
  if (
    telefono &&
    (!/^\+?[0-9 ()-]{6,30}$/.test(telefono) ||
      telefono.replace(/\D/g, "").length < 6 ||
      telefono.replace(/\D/g, "").length > 15)
  )
    throw new Error("Ingresa un teléfono válido, incluyendo el código de país si corresponde.");
  return { nombre, telefono: telefono || null };
}
export function validarNuevaClave(password: string, confirmacion: string) {
  if (password.length < 8 || password.length > 128 || !password.trim())
    throw new Error("La contraseña debe tener entre 8 y 128 caracteres.");
  if (password !== confirmacion) throw new Error("Las contraseñas no coinciden.");
}
