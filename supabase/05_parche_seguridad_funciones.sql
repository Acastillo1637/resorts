-- =====================================================================
-- PARCHE DE SEGURIDAD: fn_crear_reserva, fn_checkin, fn_checkout y
-- fn_cancelar_reserva pasan a SECURITY DEFINER porque necesitan escribir
-- en más de una tabla (reservas + facturas) y "facturas" no tiene
-- política de INSERT/UPDATE para el navegador (correcto: un cliente o
-- recepcionista jamás debería poder tocar facturas directamente).
--
-- Al ser SECURITY DEFINER estas funciones ya NO dependen de las
-- políticas RLS de la tabla para protegerse -- por eso cada una valida
-- "a mano", dentro de su propio código, que quien la llama tiene
-- permiso para hacer esa operación puntual. Esto es exactamente el
-- patrón recomendado por OWASP: un gateway controlado en vez de abrir
-- la tabla completa.
--
-- Ejecutar esto reemplaza (CREATE OR REPLACE) las funciones ya creadas
-- por sql/03_funciones.sql -- no hace falta borrar nada antes.
-- =====================================================================

set search_path = public;

create or replace function fn_crear_reserva(
  p_habitacion_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
)
returns reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hotel_id uuid;
  v_precio numeric;
  v_noches int;
  v_reserva reservas;
begin
  if mi_rol() <> 'cliente' then
    raise exception 'Solo un cliente puede crear una reserva propia';
  end if;

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

create or replace function fn_checkin(p_reserva_id uuid)
returns reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserva reservas;
  v_hotel uuid;
begin
  select hotel_id into v_hotel from reservas where id = p_reserva_id;
  if v_hotel is null then
    raise exception 'Reserva no encontrada';
  end if;

  if mi_rol() not in ('gerente','recepcionista') then
    raise exception 'No autorizado';
  end if;
  if mi_hotel() is not null and mi_hotel() <> v_hotel then
    raise exception 'No autorizado para operar reservas de otro hotel';
  end if;

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
security definer
set search_path = public
as $$
declare
  v_reserva reservas;
  v_hotel uuid;
begin
  select hotel_id into v_hotel from reservas where id = p_reserva_id;
  if v_hotel is null then
    raise exception 'Reserva no encontrada';
  end if;

  if mi_rol() not in ('gerente','recepcionista') then
    raise exception 'No autorizado';
  end if;
  if mi_hotel() is not null and mi_hotel() <> v_hotel then
    raise exception 'No autorizado para operar reservas de otro hotel';
  end if;

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

create or replace function fn_cancelar_reserva(p_reserva_id uuid)
returns reservas
language plpgsql
security definer
set search_path = public
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
-- FIN 05_parche_seguridad_funciones.sql
-- =====================================================================
