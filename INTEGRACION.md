# Maremoto + Supabase

## Actualización de gestión hotelera

Si ya ejecutaste 01–06, aplica **solo** `supabase/07_gestion_hotelera.sql` en el SQL
Editor de Supabase. La aplicación actual necesita esa migración antes de usarse.
La migración corre en una transacción y registra su versión; repetirla produce
un mensaje de “ya aplicada” sin modificar datos. No vuelvas a ejecutar el esquema 01
en una base existente.

Después ejecuta `09_verificacion.sql` (solo lectura). Revisa las inconsistencias
históricas antes de validar las restricciones indicadas al final del archivo.
No se inventan pagos para facturas antiguas: concilia sus comprobantes reales.

### Efectos sobre datos existentes

07 no elimina tablas ni registros, pero sí completa `reservas.tarifa_noche` a partir
de facturas (o la tarifa actual de habitación), y `servicios_contratados.precio_unitario`
con el precio actual del servicio. El UPDATE de reservas dispara los triggers
existentes de eventos y auditoría. También asigna valores iniciales a columnas nuevas
(por ejemplo, un adulto, cero niños y hotel activo); no son datos históricos verificados.
Las facturas conservan sus importes durante la migración. Si incluían servicios,
el cálculo posterior podría contarlos nuevamente: revisar esos casos antes de operar.

Antes de aplicarla, guarda un respaldo de la base y pruébala sobre una copia.
Verifica que el esquema corresponde a 01–06; la migración usa nombres concretos de
restricciones y políticas. Puede bloquear escrituras mientras modifica tablas e índices,
por lo que conviene una ventana de mantenimiento. Si falla una instrucción, la
transacción revierte sus cambios; no continúes ejecutando fragmentos por separado.

### Continuar desde otro PC

1. Clona el repositorio y selecciona la rama respaldada.
2. Instala Node 24 y ejecuta `npm ci` usando `package-lock.json`.
3. Copia `.env.example` a `.env` y configura localmente URL y clave pública de Supabase.
   El archivo `.env` y las bases locales no forman parte del respaldo Git.
4. Comprueba el respaldo de la base y el resultado del ensayo de 07 en una copia.
5. En el proyecto Supabase correcto, ejecuta **todo** `07_gestion_hotelera.sql` una vez.
6. Ejecuta `09_verificacion.sql`; concilia los datos heredados y valida las restricciones
   pendientes únicamente después de resolver sus inconsistencias.
7. Ejecuta `npm run dev` y prueba cliente, recepción, gerente de hotel y gerente general.
   Verifica Auth con confirmación de correo, PostgREST, RLS, Realtime, concurrencia,
   pagos/reembolsos, check-in/out y la interfaz en móvil y escritorio.

`08_datos_demo.sql` es opcional y exclusivo para pruebas: añade datos ficticios
sin contraseñas. No ejecutarlo en producción. Para una instalación nueva, usa el
orden 01, 02, 03, 04_datos_ejemplo_maremoto, 05, 06, 07; luego 08 si corresponde.

### Validación local

Con Node 24 y las dependencias instaladas:

```sh
npm run typecheck
npm test
npm run lint
npm run build
```

Para `npm run test:db`, inicia un PostgreSQL **local de pruebas** y define PG_BIN,
PGPORT (por defecto 55439) y PGUSER. El script crea una base con nombre único,
simula Auth, ejecuta las migraciones y pruebas, y elimina únicamente esa base al
terminar. No conectarlo a una instancia de producción. En Windows usa PostgreSQL
17 en `C:/Program Files/PostgreSQL/17/bin` por defecto.

Informe de cambios, pruebas y limitaciones: `docs/ENTREGA.md`.

La carpeta conserva la UI original de `maremoto-source` y reemplaza el prototipo visual de `resorts` por rutas React/TanStack conectadas a la misma lógica Supabase.

## 1. Instalar y configurar

```bash
npm install
cp .env.example .env
```

Completa `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Nunca uses `service_role` en el navegador.

## 2. Supabase

Solo para una base nueva: en SQL Editor ejecuta `01_schema.sql`, `02_seguridad_rls.sql`,
`03_funciones.sql`, **`04_datos_ejemplo_maremoto.sql`**, `05_parche_seguridad_funciones.sql`,
`06_realtime.sql` y `07_gestion_hotelera.sql`. Para una base existente usa las
instrucciones de actualización al inicio de este documento.

## 3. Funciones integradas

- Login y registro de clientes con validación de RUT.
- Redirección por rol: cliente, recepcionista y gerente.
- Cliente: disponibilidad, alternativas automáticas, reserva real y cancelación.
- Recepción: reservas del hotel, check-in, check-out, servicios adicionales y Realtime.
- Gerencia: indicadores, reservas, habitaciones y administración general multi-hotel.
- PostgreSQL mantiene anti-overbooking, auditoría, facturación y RLS del prototipo original.

## 4. Personal interno

Crea recepcionistas y gerentes desde Supabase Auth y agrega su fila en `perfiles`, tal como explica el README original de `resorts`. El registro público solo crea clientes.

## 5. Ejecutar

```bash
npm run dev
```

La aplicación de 07 y las pruebas autenticadas en Supabase quedan pendientes del respaldo Git.
