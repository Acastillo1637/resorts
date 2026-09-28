# Revisión inicial — 28 septiembre 2026

## Arquitectura existente

React 19 y TypeScript, TanStack Start/Router con renderizado SSR, Vite 8,
Tailwind 4 y componentes Radix/shadcn. React Query está instalado y su proveedor
ya existe. Las rutas públicas usan fotografías y un catálogo editorial local.
Las rutas acceso, registro, mi-cuenta, recepcion y gerencia consumen Supabase
directamente. No hay servidor REST propio: PostgreSQL, RLS y RPC forman el backend.

Supabase tiene regiones, hoteles, habitaciones, perfiles ligados a Auth, reservas,
servicios, facturas, eventos y auditoría. La exclusión GiST sobre habitación y fechas
es una protección valiosa contra reservas concurrentes. Se conserva.

Los roles existentes son cliente, recepcionista y gerente; un gerente sin hotel
administra la cadena. Los archivos 01–06 son instalaciones SQL manuales, no existe
un registro de migraciones ni pruebas automatizadas. La carpeta no tiene .git.

## Problemas encontrados

- Las funciones SECURITY DEFINER comparan roles sin tratar NULL y varias carecen
  de search_path fijo. Hay escrituras directas que eluden reglas de negocio.
- El perfil permite cambios de hotel; los eventos se muestran a todo el personal.
- Check-out marca una factura pagada sin movimiento de dinero.
- Las reservas no guardan tarifa histórica, adultos, niños ni horas de entrada/salida.
- No existe edición de reservas ni ficha de huésped sin cuenta de acceso.
- El dashboard cuenta únicamente las últimas 50 reservas y omite errores de consultas.
- Registro depende de una sesión inmediata y falla con confirmación de correo activa.
- Recepción y gerencia son componentes comprimidos con any y lógica duplicada.
- Formularios públicos no trasladan los criterios al portal; hay controles editoriales
  de suscripción y enlaces legales sin implementación.
- TypeScript falla por acceso a variables de entorno mediante notación de punto.

## Decisiones

Ampliar el esquema existente mediante 07, sin borrar reservas ni reescribir 01–06.
Usar transacciones RPC para reservas, servicios y pagos; conservar facturación,
auditoría, alternativas por región, RUT y exclusión de fechas. Añadir huéspedes
sin exigir cuentas Auth. Mantener los roles y aplicar permisos por hotel en RLS.
Compartir panel operativo y componentes de formularios. Separar catálogo editorial
de tarifas efectivas, que siempre se consultan y calculan en PostgreSQL.

Validar en una base PostgreSQL temporal independiente; nunca usar datos remotos
para las pruebas ni ejecutar semillas de demostración en producción.
