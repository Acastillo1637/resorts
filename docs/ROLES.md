# Roles por hotel (migración 15)

## Aplicación manual

1. No ejecutar nada todavía en Auth ni reasignar cuentas. Revisar desde SQL Editor: `select id,nombre,rol,hotel_id from public.perfiles where (rol in ('gerente','recepcionista') and hotel_id is null) or (rol in ('cliente','gerente_general') and hotel_id is not null);`. Si devuelve filas, decidir explícitamente si el gerente antiguo era central (asignar gerente_general después de ampliar el check) o qué hotel le corresponde. La migración 15 se detiene y revierte todo si hay filas incompatibles; no las convierte automáticamente. Si aparece un gerente central antiguo con hotel NULL, detener la aplicación y resolver explícitamente su transición con el propietario; no asignarle un hotel temporal ni convertirlo automáticamente.
2. Verificar que 14 esté aplicada: `select version from public.migraciones_maremoto order by version;`.
3. **SQL Editor → New query → pegar TODO `supabase/15_roles_alcance_hoteles.sql` → Run**. Nunca volver a ejecutar migraciones antiguas para este cambio. No se aplica automáticamente desde la aplicación.
4. Consultar hoteles reales: `select id,nombre from public.hoteles where nombre in ('Resort Santiago Centro','Tierra Atacama','Explora Torres del Paine') order by nombre;`. Debe existir exactamente uno de cada nombre. Santiago Centro proviene de una semilla antigua distinta a la del catálogo actual: si no existe en tu base, detener la asignación de Santiago y confirmar el hotel correcto; no inventar su UUID ni sustituirlo por NOI Vitacura. Los hoteles se consultan desde Supabase; no se crean hoteles en 15.

## Cuentas requeridas

| Correo propuesto                     | Nombre              | Rol             | Hotel                    |
| ------------------------------------ | ------------------- | --------------- | ------------------------ |
| gerencia@almondresorts.cl            | Gerencia General    | gerente_general | NULL                     |
| gerencia.santiago@almondresorts.cl   | Gerente Santiago    | gerente         | Resort Santiago Centro   |
| recepcion.santiago@almondresorts.cl  | Recepción Santiago  | recepcionista   | Resort Santiago Centro   |
| gerencia.atacama@almondresorts.cl    | Gerente Atacama     | gerente         | Tierra Atacama           |
| recepcion.atacama@almondresorts.cl   | Recepción Atacama   | recepcionista   | Tierra Atacama           |
| gerencia.patagonia@almondresorts.cl  | Gerente Patagonia   | gerente         | Explora Torres del Paine |
| recepcion.patagonia@almondresorts.cl | Recepción Patagonia | recepcionista   | Explora Torres del Paine |

Después de aplicar 15: **Authentication → Users → Add user → Create new user**, ingresar cada correo y una contraseña individual segura. Si ya existe la cuenta, reutilizarla; no eliminarla ni crear un duplicado. Copiar el ID real generado por Auth. No usar SQL para crear Auth ni inventar IDs. Las contraseñas no se guardan en public.perfiles ni se comparten en código.

En **Table Editor → public.perfiles**, localizar la fila por ese ID. Si el trigger ya creó un perfil, editar esa fila. Si falta, insertar una fila con `id`=ID real de Auth, `rut`=RUT real único válido de la persona responsable, `nombre`=nombre de la tabla, `telefono`=teléfono permitido o NULL, `rol` y `hotel_id` conjuntamente según la tabla. Para hotel_id copiar el ID real devuelto por la consulta del paso 4. Dejar `creado_en` con su valor predeterminado (el esquema del repositorio usa este nombre). No inventar RUTs; si las cuentas operativas no tienen responsables con RUT únicos, resolver esa regla de identidad antes de crearlas. El modelo actual exige RUT NOT NULL, único y válido.

El registro público siempre crea cliente con hotel NULL. La promoción/asignación se hace solo desde el administrador del proyecto; tampoco gerente_general tiene permiso API para editar roles/hotel de perfiles ni acceder a auth/secrets. Confirm email OFF permite registro sin correo; las cuentas creadas desde Auth deben quedar confirmadas usando la opción del Dashboard si su configuración lo requiere.

## Seguridad y alcance

`puede_operar` consulta el perfil real de auth.uid() y comprueba el hotel existente: recepción/gerente solo su hotel, gerente_general todos. RLS de reservas, huéspedes, pagos, facturas, eventos y perfiles de clientes hereda ese alcance. Se actualizan las policies de hoteles/habitaciones/servicios/paquetes; auditoría y categorías globales quedan solo a gerencia_general. Reservas personales requieren rol cliente. La RPC de cambio de estado conserva validaciones de saldo/transiciones y exige alcance hotel o cliente titular para cancelar. La RPC de paquetes admite ambas gerencias manteniendo autorización y relaciones hotel/servicio. No cambia RLS de suscripciones, grants financieros, precios, exclusión de solapamientos ni permisos internos de 14.

Gerencia General reutiliza `/gerencia`, con vista global y selector real. Todos los hoteles permite consolidar las vistas de lectura; crear reservas/fichas/paquetes exige elegir hotel. Gerencia y Recepción muestran su hotel sin selector. Las categorías de habitación son un catálogo global: gerente normal puede asignar categorías existentes y editar tarifas/unidades de su hotel; solo gerente_general crea categorías compartidas.

## Comprobación

Ejecutar `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Los tests de frontend prueban acceso a rutas administrativas y limpieza de roles al logout/login; los existentes comprueban la lista blanca del perfil. Las pruebas reales RLS están en `tests/roles-rls.sql`: después de crear las cuentas y al menos un cliente, ejecutar su contenido completo desde SQL Editor, con ambas sentencias BEGIN/ROLLBACK. No crea usuarios ni conserva cambios; verifica alcance de tres hoteles, denegación de UPDATE rol/hotel, acceso central y aislamiento por tablas. Probar además login con cada rol, selección global, Mi cuenta/header y logout. No usar el runner antiguo test:db como evidencia de 15: su esquema/semillas cubren hasta 14.

Pendientes externos: aplicar 15, verificar hoteles/cuentas/RUT y ejecutar pruebas RLS en un entorno disponible. No se accedió al Dashboard ni se crearon cuentas reales durante la implementación. `npm run test:db` se intentó y no pudo conectar al PostgreSQL local en 127.0.0.1:55439; por tanto la migración 15 y las pruebas SQL todavía requieren validación en PostgreSQL real. Tests automatizados del frontend: 25 correctos; typecheck/build correctos; lint sin errores, con 6 advertencias preexistentes.
