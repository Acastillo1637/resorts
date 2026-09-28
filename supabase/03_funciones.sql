-- =====================================================================
-- FUNCIONES DE NEGOCIO (RPC llamadas desde el frontend vía supabase.rpc)
-- =====================================================================

-- ---------------------------------------------------------------------
-- RF-04 / búsqueda de disponibilidad en un hotel para un rango de fechas
-- ---------------------------------------------------------------------
create or replace function fn_disponibilidad(
  p_hotel_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_tipo text default null
)
returns setof habitaciones
language sql
stable
security definer
as $$
  select h.*
  from habitaciones h
  where h.hotel_id = p_hotel_id
    and h.estado = 'activa'
    and (p_tipo is null or h.tipo = p_tipo)
    and not exists (
      select 1 from reservas r
      where r.habitacion_id = h.id
        and r.estado in ('confirmada','check_in')
        and daterange(r.fecha_inicio, r.fecha_fin) && daterange(p_fecha_inicio, p_fecha_fin)
    );
$$;

-- ---------------------------------------------------------------------
-- RF-03: si el hotel solicitado no tiene cupo, sugerir automáticamente
-- otros hoteles CON DISPONIBILIDAD dentro de la MISMA REGIÓN.
-- ---------------------------------------------------------------------
create or replace function fn_sugerir_alternativas(
  p_hotel_id_original uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_tipo text default null
)
returns table (
  hotel_id uuid,
  hotel_nombre text,
  habitacion_id uuid,
  numero text,
  tipo text,
  precio_noche numeric
)
language sql
stable
security definer
as $$
  select ht.id, ht.nombre, h.id, h.numero, h.tipo, h.precio_noche
  from habitaciones h
  join hoteles ht on ht.id = h.hotel_id
  where ht.region_id = (select region_id from hoteles where id = p_hotel_id_original)
    and h.hotel_id <> p_hotel_id_original
    and h.estado = 'activa'
    and (p_tipo is null or h.tipo = p_tipo)
    and not exists (
      select 1 from reservas r
      where r.habitacion_id = h.id
        and r.estado in ('confirmada','check_in')
        and daterange(r.fecha_inicio, r.fecha_fin) && daterange(p_fecha_inicio, p_fecha_fin)
    )
  order by h.precio_noche asc;
$$;

-- ---------------------------------------------------------------------
-- RF-01 / RF-02: crear una reserva. La restricción EXCLUDE de la tabla
-- reservas es la que impide el overbooking de forma incondicional; si
-- dos clientes intentan reservar la misma habitación al mismo tiempo,
-- Postgres serializa y rechaza automáticamente al segundo con el error
-- 23P01 (exclusion_violation). El frontend detecta ese código y llama
-- a fn_sugerir_alternativas.
-- También genera la factura vía el "Adapter" (tabla facturas) que
-- simula al sistema de facturación heredado.
-- ---------------------------------------------------------------------
create or replace function fn_crear_reserva(
  p_habitacion_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
returns reservas
language plpgsql
security invoker -- corre como el cliente: respeta su propia RLS de inserción
as $$
declare
  v_hotel_id uuid;
  v_precio numeric;
  v_noches int;
  v_reserva reservas;
begin
  select hotel_id, precio_noche into v_hotel_id, v_precio
  from habitaciones where id = p_habitacion_id;

  if v_hotel_id is null then
    raise exception 'Habitación no encontrada';
  end if;

  v_noches := p_fecha_fin - p_fecha_inicio;

  insert into reservas (cliente_id, habitacion_id, hotel_id, fecha_inicio, fecha_fin)
  values (auth.uid(), p_habitacion_id, v_hotel_id, p_fecha_inicio, p_fecha_fin)
  returning * into v_reserva;

  insert into facturas (reserva_id, monto_total, referencia_sistema_legado)
  values (v_reserva.id, v_precio * v_noches, 'LEGACY-' || substr(v_reserva.id::text, 1, 8));

  return v_reserva;
end;
$$;

-- ---------------------------------------------------------------------
-- RF-06: Check-in / Check-out
-- ---------------------------------------------------------------------
create or replace function fn_checkin(p_reserva_id uuid)
returns reservas
language plpgsql
security invoker
as $$
declare v_reserva reservas;
begin
  update reservas set estado = 'check_in'
  where id = p_reserva_id and estado = 'confirmada'
  returning * into v_reserva;

  if v_reserva.id is null then
    raise exception 'La reserva no existe o no está en estado confirmada';
  end if;
  return v_reserva;
end;
$$;

create or replace function fn_checkout(p_reserva_id uuid)
returns reservas
language plpgsql
security invoker
as $$
declare v_reserva reservas;
begin
  update reservas set estado = 'check_out'
  where id = p_reserva_id and estado = 'check_in'
  returning * into v_reserva;

  if v_reserva.id is null then
    raise exception 'La reserva no existe o no está en estado check_in';
  end if;

  update facturas set estado = 'pagada' where reserva_id = p_reserva_id;

  return v_reserva;
end;
$$;

-- ---------------------------------------------------------------------
-- Cancelación por el cliente (antes del check-in)
-- ---------------------------------------------------------------------
create or replace function fn_cancelar_reserva(p_reserva_id uuid)
returns reservas
language plpgsql
security invoker
as $$
declare v_reserva reservas;
begin
  update reservas set estado = 'cancelada'
  where id = p_reserva_id and cliente_id = auth.uid() and estado = 'confirmada'
  returning * into v_reserva;

  if v_reserva.id is null then
    raise exception 'No se puede cancelar esta reserva';
  end if;

  update facturas set estado = 'anulada' where reserva_id = p_reserva_id;
  return v_reserva;
end;
$$;

-- =====================================================================
-- FIN 03_funciones.sql
-- =====================================================================
