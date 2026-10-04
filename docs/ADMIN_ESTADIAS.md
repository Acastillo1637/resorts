# Navegación administrativa y migración 16

Aplicar manualmente **todo `supabase/16_navegacion_estadias.sql`** en Supabase → SQL Editor → New query → Run, después de 15. No se aplicó SQL ni se modificaron 14/15. El frontend ahora solicita la columna calculada `estado_vigente`; aplicar 16 antes de probar esta versión del panel o Mis reservas. Sin 16, las consultas mostrarán un error de carga con opción Reintentar.

## Ver reserva

Se detectó la llamada `crypto.randomUUID()` al montar el detalle: esa API no existe en contextos inseguros como una IP LAN por HTTP. Se sustituyó por UUID v4 con `crypto.getRandomValues`, conservando idempotencia sin usar Math.random. La prueba reproduce el entorno sin randomUUID. Sin acceso a la sesión real/log del navegador no se puede asegurar que fuera la única causa del error reportado.

El detalle se consulta nuevamente en Supabase por ID, con RLS y comprobación adicional de rol/hotel. Si el servidor deniega/oculta la fila, muestra no encontrado/no autorizado; los errores de consulta permiten Reintentar. La caché incluye identidad/rol/hotel, las relaciones de pagos/servicios se normalizan y se corrige la actualización de la caché de gestión para sus claves actuales. No se agrega una ruta pública a reservas privadas.

## Roles

Clientes conservan Mi cuenta/Mis reservas/Reservar/logout. Gerencias tienen Gestión/Crear paquete/logout; recepción, Gestión de estadías/logout. Mi cuenta redirige perfiles administrativos a su panel y RLS deniega la actualización personal de esos perfiles. Recepción no administra hoteles, tarifas, servicios del catálogo ni paquetes; puede operar reservas y fichas de huéspedes. La RPC de contratación de servicios conserva su autorización operativa.

Crear paquete lleva a Gerencia → Paquetes. Gerencia General selecciona un hotel real; gerente usa su hotel fijo. Servicios/categorías se filtran por ese hotel, y la RPC de 15 sigue validando el alcance sin confiar en el frontend. Todos los hoteles permite lectura consolidada y edición de paquetes existentes según su hotel; crear requiere seleccionar uno.

## Estadías vencidas

`check_out` significa **Checkout realizado**, exclusivamente tras un cierre operativo validado. `estado_vigente(reservas)` devuelve el valor derivado **vencida** cuando `fecha_fin` es anterior al día actual en America/Santiago y el estado registrado es pendiente/confirmada/check_in. Canceladas y checkout real se conservan; el día exacto de salida no vence. No se usa fecha_inicio.

El valor derivado no reemplaza `estado` ni escribe `salida_en`. Se conservan historial y deuda. Gestión separa Activas, Historial, Vencidas y Sin checkout/regularización. Un check_in vencido aparece además en una sección destacada con su saldo y botón para registrar checkout real: exige alcance del hotel, estado almacenado check_in y saldo pagado, y solo entonces escribe estado=check_out y salida_en=ahora. Pendientes/confirmadas vencidas no pueden convertirse en checkout; requieren revisión operativa, sin nuevas transiciones artificiales. Las RPC bloquean editar/reactivar/cancelar/añadir servicios a vencidas. Se mantienen pagos/reembolsos y la protección de cambios incompatibles en habitaciones con check_in aún sin cerrar. No hay cron ni escrituras automáticas desde React.

## Validación pendiente en Supabase

Ejecutar `tests/estadias-vencidas.sql` completo (BEGIN/ROLLBACK) después de aplicar 16. Reutilizar `tests/roles-rls.sql` con las cuentas existentes para comprobar aislamiento/RPC; no crea cuentas. Probar con cliente, gerente_general, gerente y recepción: header/logout, abrir reserva propia, hotel ajeno denegado, crear paquete permitido solo a gerencias y recuperación de estados de carga/error. Intentar UPDATE del nombre de un administrativo desde el API debe afectar cero filas bajo RLS, mientras nombre/teléfono de cliente siguen editables.

Las pruebas locales no sustituyen probar sesiones reales ni validar la migración en PostgreSQL: no hay servidor local disponible en 127.0.0.1:55439. No se aplicó nada automáticamente en Supabase.
