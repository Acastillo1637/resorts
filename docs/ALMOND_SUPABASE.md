# Aplicar Almond Resorts

En Supabase → SQL Editor → New query, pegar el contenido completo de cada archivo y pulsar Run, por separado y en este orden:

1. `supabase/07_gestion_hotelera.sql` (requiere las migraciones 01–06; ahora puede repetirse sin modificar datos si la versión 7 ya está aplicada).
2. `supabase/10_almond_catalogo.sql`.
3. `supabase/11_hoteles_chile.sql`.
4. `supabase/12_inventario_demo_portadas.sql` (si 07/10/11 ya están aplicadas, ejecutar solo este archivo).
5. `supabase/13_paquetes_productos.sql` (si 07–12 ya están aplicadas, ejecutar solo 13; detalles en `docs/PAQUETES.md`).

No ejecutar 04 ni 08 en producción: contienen datos de ejemplo. Las migraciones 10 y 11 pueden repetirse y no eliminan datos. Ambas recargan el schema cache de PostgREST. El error de `public.huespedes` proviene de usar el portal de gestión sin tener aplicado su esquema 07; crear solo esa tabla no basta. La versión 07 añade también pagos, columnas de reservas, RLS, funciones y el trigger de perfiles Auth.

La configuración actual de autenticación y los pasos de verificación están en [AUTH.md](./AUTH.md). No copiar un puerto de ejemplo a Site URL: usar el origen donde la aplicación realmente esté disponible.

Los 13 hoteles de la migración 11 son reales, con fuentes oficiales en `fuente_url`. La migración 12 habilita inventario **demo** para todos: una doble (2 huéspedes), una suite (2) y una familiar (4) por hotel, tarifas base de 11 y factores 1/1,35/1,65. Las 39 unidades activas tienen números DEMO-D01, DEMO-S01 y DEMO-F01. Las categorías CAT-DOBLE se conservan inactivas. No se modifican reservas, tarifas históricas ni unidades existentes. Repetir la migración no duplica unidades ni revierte precios/estados editados por la administración. Solo la primera aplicación habilita los hoteles de la semilla.

Las búsquedas y reservas demo usan Supabase y las funciones existentes, incluida la restricción de exclusión de reservas solapadas. Los paquetes de dos noches se reservan con las unidades dobles activas, sus servicios y factura en la misma transacción. Esto no integra cupos comerciales de los establecimientos externos.

Desde Gerencia → Hoteles se pueden habilitar reservas, elegir destino/destacado y cargar portada HTTPS o ruta local `/images/hoteles/`. Las portadas de ambiente existentes se asignan por zona en `hoteles.imagen_url`. Se reutiliza esa misma imagen en Destacados, Hoteles, paquetes, ficha y selector del portal. La imagen cambia con el hotel seleccionado; el componente HotelCover usa fallback para URL vacía o fallida. Las imágenes de ambiente se rotulan explícitamente. Desde Habitaciones y Servicios se mantienen capacidades, tarifas y condiciones demo.

Los paquetes se almacenan en `paquetes` y `paquete_servicios`, reutilizando `servicios_adicionales`. Las claves foráneas impiden incluir un servicio de otro hotel. `fn_reservar_paquete` verifica hotel, habitación, duración, capacidad y servicios activos; registra reserva, servicios y factura en una sola transacción, conservando precios históricos. Los paquetes de esta semilla admiten hasta dos huéspedes. Modificar fechas o habitación de un paquete confirmado requiere atención del hotel; su cancelación usa el flujo existente.

Las páginas de privacidad y términos son avisos operativos: completar datos de identificación/contacto de la entidad que opere Almond Resorts antes de publicar.

Validación local: `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`. `npm run test:db` requiere PostgreSQL 17 local en `127.0.0.1:55439`; aplica 07/10/11/12 dos veces y ejecuta pruebas RLS, precios, atomicidad, disponibilidad de los 13 hoteles y concurrencia en una base temporal.
