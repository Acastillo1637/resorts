-- =====================================================================
-- CADENA DE RESORTS - Motor Centralizado de Reservas
-- Esquema de base de datos para Supabase (PostgreSQL)
-- Cubre RF-01 a RF-07 y RNF-01 a RNF-04 del enunciado EV03
-- Implementa a nivel de base de datos los patrones Singleton (motor
-- central único, garantizado por el propio motor de Postgres),
-- Adapter (tabla facturas simula el sistema de facturación heredado)
-- y Observer (tabla eventos_reserva + triggers)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONES NECESARIAS
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists btree_gist; -- restricciones EXCLUDE con rangos (clave para RF-02)

-- ---------------------------------------------------------------------
-- 1. FUNCION DE VALIDACION DE RUT CHILENO (dígito verificador, mod 11)
--    Se usa como CHECK constraint -> ningún RUT inválido puede llegar
--    a la base de datos, sin importar qué capa de la app lo permita.
-- ---------------------------------------------------------------------
create or replace function validar_rut(rut text)
returns boolean
language plpgsql
immutable
as $$
declare
  limpio text;
  cuerpo text;
  dv text;
  suma int := 0;
  multiplo int := 2;
  resto int;
  dv_esperado text;
  i int;
begin
  if rut is null then return false; end if;
  limpio := upper(regexp_replace(rut, '[^0-9kK]', '', 'g'));
  if length(limpio) < 2 then return false; end if;

  cuerpo := substring(limpio from 1 for length(limpio) - 1);
  dv := substring(limpio from length(limpio) for 1);

  if cuerpo !~ '^[0-9]{7,8}$' then return false; end if;

  for i in reverse length(cuerpo)..1 loop
    suma := suma + (substring(cuerpo from i for 1)::int * multiplo);
    multiplo := multiplo + 1;
    if multiplo > 7 then multiplo := 2; end if;
  end loop;

  resto := 11 - (suma % 11);
  if resto = 11 then dv_esperado := '0';
  elsif resto = 10 then dv_esperado := 'K';
  else dv_esperado := resto::text;
  end if;

  return dv = dv_esperado;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. CATALOGO: REGIONES Y HOTELES
-- ---------------------------------------------------------------------
create table regiones (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique
);

create table hoteles (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  region_id  uuid not null references regiones(id),
  direccion  text,
  creado_en  timestamptz not null default now()
);

create table habitaciones (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     uuid not null references hoteles(id) on delete cascade,
  numero       text not null,
  tipo         text not null check (tipo in ('individual','doble','suite','familiar')),
  capacidad    int  not null default 2,
  precio_noche numeric(10,2) not null check (precio_noche >= 0),
  estado       text not null default 'activa' check (estado in ('activa','mantenimiento','inactiva')),
  unique (hotel_id, numero)
);

-- ---------------------------------------------------------------------
-- 3. PERFILES (usuarios de negocio, vinculados 1:1 a auth.users)
--    rol: 'cliente' | 'recepcionista' | 'gerente'
--    hotel_id:
--      - cliente         -> siempre NULL
--      - recepcionista   -> obligatorio (RF-05 / RNF-03: interfaz se
--                           adapta automáticamente a ESE hotel)
--      - gerente         -> con hotel_id = gerente de ese hotel
--                           con hotel_id NULL = Administración General
--                           (visión centralizada de todos los hoteles, RF-01)
-- ---------------------------------------------------------------------
create table perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  rut         text not null unique check (validar_rut(rut)),
  nombre      text not null,
  rol         text not null check (rol in ('cliente','recepcionista','gerente')),
  hotel_id    uuid references hoteles(id),
  telefono    text,
  creado_en   timestamptz not null default now(),
  constraint hotel_obligatorio_recepcion check (rol <> 'recepcionista' or hotel_id is not null),
  constraint sin_hotel_para_cliente check (rol <> 'cliente' or hotel_id is null)
);

-- ---------------------------------------------------------------------
-- 4. RESERVAS
--    La restricción EXCLUDE es la garantía real de no-overbooking
--    (RF-02): Postgres rechaza a nivel de motor cualquier reserva que
--    se solape en fechas para la misma habitación, sin importar
--    condiciones de carrera, bugs de la app o llamadas concurrentes.
--    Esto reemplaza/ refuerza al patrón Singleton descrito en el
--    informe: aquí la "instancia única" que evita el overbooking es
--    la propia restricción del motor de base de datos.
-- ---------------------------------------------------------------------
create table reservas (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references perfiles(id),
  habitacion_id uuid not null references habitaciones(id),
  hotel_id      uuid not null references hoteles(id),
  fecha_inicio  date not null,
  fecha_fin     date not null,
  estado        text not null default 'confirmada'
                 check (estado in ('confirmada','check_in','check_out','cancelada')),
  creado_en     timestamptz not null default now(),
  check (fecha_fin > fecha_inicio),
  exclude using gist (
    habitacion_id with =,
    daterange(fecha_inicio, fecha_fin) with &&
  ) where (estado in ('confirmada','check_in'))
);

create index idx_reservas_cliente on reservas(cliente_id);
create index idx_reservas_hotel   on reservas(hotel_id);

-- ---------------------------------------------------------------------
-- 5. SERVICIOS ADICIONALES POR HOTEL (RF-07)
--    Se agregan/retiran por hotel sin tocar el núcleo (reservas).
-- ---------------------------------------------------------------------
create table servicios_adicionales (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references hoteles(id) on delete cascade,
  nombre      text not null,
  descripcion text,
  precio      numeric(10,2) not null check (precio >= 0),
  activo      boolean not null default true
);

create table servicios_contratados (
  id             uuid primary key default gen_random_uuid(),
  reserva_id     uuid not null references reservas(id) on delete cascade,
  servicio_id    uuid not null references servicios_adicionales(id),
  cantidad       int not null default 1 check (cantidad > 0),
  contratado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. FACTURAS -> punto de integración con el sistema heredado (Adapter)
--    referencia_sistema_legado simula el folio que devolvería el
--    sistema de facturación existente, integrado sin modificarlo.
-- ---------------------------------------------------------------------
create table facturas (
  id                       uuid primary key default gen_random_uuid(),
  reserva_id               uuid not null references reservas(id),
  monto_total              numeric(10,2) not null default 0,
  estado                   text not null default 'pendiente'
                            check (estado in ('pendiente','pagada','anulada')),
  referencia_sistema_legado text,
  emitida_en               timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. EVENTOS DE RESERVA (patrón Observer)
--    Cada cambio relevante en una reserva se publica aquí. Otros
--    módulos (estadísticas, notificaciones) "observan" esta tabla
--    (por ejemplo vía Supabase Realtime) sin acoplarse al motor central.
-- ---------------------------------------------------------------------
create table eventos_reserva (
  id          uuid primary key default gen_random_uuid(),
  reserva_id  uuid not null references reservas(id) on delete cascade,
  tipo_evento text not null,
  detalle     jsonb,
  creado_en   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 8. AUDITORIA (ISO 27000 / Ley 21.459 - trazabilidad de accesos)
-- ---------------------------------------------------------------------
create table auditoria (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid,
  accion      text not null,
  tabla       text not null,
  registro_id uuid,
  detalle     jsonb,
  creado_en   timestamptz not null default now()
);

-- SECURITY DEFINER: estas funciones de trigger corren con privilegios
-- del dueño de la tabla (no del cliente/recepcionista que disparó la
-- acción), así que pueden escribir en eventos_reserva/auditoria aunque
-- el rol que originó el cambio no tenga permiso directo de escritura
-- ahí (principio de mínimo privilegio, OWASP A01).
create or replace function fn_registrar_evento_reserva()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into eventos_reserva (reserva_id, tipo_evento, detalle)
  values (
    new.id,
    case when TG_OP = 'INSERT' then 'reserva_creada' else 'reserva_actualizada:' || new.estado end,
    to_jsonb(new)
  );
  return new;
end;
$$;

create trigger trg_evento_reserva
after insert or update on reservas
for each row execute function fn_registrar_evento_reserva();

create or replace function fn_auditar()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into auditoria (usuario_id, accion, tabla, registro_id, detalle)
  values (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    to_jsonb(coalesce(new, old))
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_auditar_reservas
after insert or update or delete on reservas
for each row execute function fn_auditar();

create trigger trg_auditar_perfiles
after insert or update on perfiles
for each row execute function fn_auditar();

-- =====================================================================
-- FIN 01_schema.sql — continúa en 02_seguridad_rls.sql
-- =====================================================================
