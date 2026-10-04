# Revisión de seguridad — migración 14

Ejecutar **todo** `supabase/14_normalizacion_seguridad.sql` en el SQL Editor del mismo proyecto Supabase, después de la migración 13. La transacción conserva IDs, huéspedes, reservas e importes. No volver a ejecutar semillas anteriores después de la 14: pueden restablecer textos, permisos o funciones antiguos.

Correcciones: permisos explícitos sin DELETE; alta de perfiles solo por el trigger Auth; acceso operativo limitado por hotel; lectura de contratos/facturas solo del titular o personal autorizado; funciones internas sin EXECUTE público; search_path protegido; ocupación mínima/exacta validada por las RPC; errores públicos sin SQL ni trazas; recuperación vinculada al evento PASSWORD_RECOVERY; compilación bloqueada ante claves privadas VITE_*.

Se conservan el precio fijado por el servidor, los contratos históricos, el bloqueo de habitación al confirmar y la exclusión de reservas solapadas. Los códigos y textos de presentación se normalizan sin convertir el inventario sintético en cupos comerciales contratados.

Validación SQL: `npm run test:db` incluye `tests/hardening.sql`, aislamiento de clientes/hoteles, permisos, ocupación exacta, precio y concurrencia. Requiere PostgreSQL local en 127.0.0.1:55439 (o PGHOST/PGPORT locales); en esta máquina no hay servidor disponible y la instalación existente impide iniciar uno por Application Control. La migración no se ha ejecutado sobre Supabase desde este chat.

Configuración externa pendiente de comprobar en el proyecto Supabase: confirmación de email, políticas de contraseña y cambio seguro, límites de Auth, SMTP y URL permitida exacta `/nueva-clave` del dominio desplegado. La suscripción pública valida el email y no permite leer direcciones; prevención de spam/automatización necesita rate limiting/CAPTCHA del servicio de entrada. Estas opciones no se verifican mediante el código del repositorio.

Referencias: [recuperación Supabase](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [seguridad de funciones](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker).
