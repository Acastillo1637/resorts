-- Ejecutar manualmente después de 15. No modifica importes ni estados registrados.
begin;
do $$ begin
 if not exists(select 1 from public.migraciones_maremoto where version=15) then raise exception 'Ejecuta primero 15'; end if;
end $$;
-- Columna calculada de PostgREST: finalización funcional por fecha_fin.
-- Mantiene el estado operativo registrado y la deuda para conciliación.
create or replace function public.estado_vigente(r public.reservas) returns text
language sql stable set search_path=pg_catalog,public,pg_temp set timezone='America/Santiago' as $$
 select case when r.estado in ('pendiente','confirmada','check_in')
 and r.fecha_fin<(now() at time zone 'America/Santiago')::date
 then 'vencida' else r.estado end;
$$;
revoke all on function public.estado_vigente(public.reservas) from public,anon;
grant execute on function public.estado_vigente(public.reservas) to authenticated;
-- Los administradores no editan perfiles desde el API personal.
drop policy if exists actualizar_mi_perfil on public.perfiles;
create policy actualizar_mi_perfil on public.perfiles for update to authenticated
 using(id=auth.uid() and rol='cliente') with check(id=auth.uid() and rol='cliente' and hotel_id is null);
-- Recepción contrata servicios vía RPC, pero no configura el catálogo/tarifas.
drop policy if exists gerente_recepcion_gestiona_servicios on public.servicios_adicionales;
create policy gerente_recepcion_gestiona_servicios on public.servicios_adicionales for all to authenticated
 using(public.mi_rol() in ('gerente','gerente_general') and public.puede_operar(hotel_id))
 with check(public.mi_rol() in ('gerente','gerente_general') and public.puede_operar(hotel_id));
create or replace function fn_guardar_reserva(p_habitacion_id uuid,p_fecha_inicio date,p_fecha_fin date,p_adultos int default 1,p_ninos int default 0,p_huesped_id uuid default null,p_reserva_id uuid default null,p_version int default null,p_notas text default '',p_estado text default 'confirmada')
returns reservas language plpgsql security definer set search_path=pg_catalog,public,pg_temp set timezone='America/Santiago' as $$
declare h habitaciones; r reservas; anterior reservas; precio numeric;
begin
 if auth.uid() is null or mi_rol() is null then raise exception 'Inicia sesión para continuar'; end if;
 if p_fecha_inicio is null or p_fecha_fin is null or p_fecha_inicio<current_date or p_fecha_fin<=p_fecha_inicio then raise exception 'Fechas inválidas: entrada desde hoy y salida posterior'; end if;
 if p_adultos is null or p_ninos is null or p_adultos<1 or p_ninos<0 or p_estado not in ('pendiente','confirmada') or p_estado is null then raise exception 'Huéspedes o estado inválidos'; end if;
 if p_reserva_id is not null then
   select * into anterior from reservas where id=p_reserva_id for update;
   if anterior.id is null or not (puede_operar(anterior.hotel_id) or coalesce(anterior.cliente_id=auth.uid(),false)) then raise exception 'Reserva no disponible'; end if;
   if anterior.estado not in ('pendiente','confirmada') or p_version is distinct from anterior.version then raise exception 'La reserva cambió; actualiza la pantalla'; end if;
 end if;
 select * into h from habitaciones where id=p_habitacion_id for update;
 if h.id is null or h.estado<>'activa' or not exists(select 1 from hoteles where id=h.hotel_id and estado='activo') then raise exception 'Habitación no disponible'; end if;
 if p_adultos+p_ninos>h.capacidad then raise exception 'Se supera la capacidad de la habitación'; end if;
 if mi_rol()<>'cliente' and not puede_operar(h.hotel_id) then raise exception 'No autorizado para este hotel'; end if;
 if anterior.id is not null and public.estado_vigente(anterior)='vencida' then raise exception 'La reserva está vencida; requiere regularización'; end if;
 if anterior.id is not null and anterior.hotel_id<>h.hotel_id then raise exception 'La edición debe conservar el hotel'; end if;
 if anterior.id is not null and (select count(*) from facturas where reserva_id=anterior.id)>1 then raise exception 'La reserva tiene varias facturas históricas; requiere conciliación antes de editar'; end if;
 if mi_rol()<>'cliente' and anterior.id is null and p_huesped_id is null then raise exception 'Selecciona un huésped'; end if;
 if p_huesped_id is not null and (mi_rol()='cliente' or not exists(select 1 from huespedes where id=p_huesped_id and hotel_id=h.hotel_id)) then raise exception 'Huésped inválido'; end if;
 precio:=case when anterior.habitacion_id=h.id then anterior.tarifa_noche else h.precio_noche end;
 if anterior.id is null then
   insert into reservas(cliente_id,huesped_id,habitacion_id,hotel_id,fecha_inicio,fecha_fin,adultos,ninos,tarifa_noche,notas,estado)
   values(case when mi_rol()='cliente' then auth.uid() end,p_huesped_id,h.id,h.hotel_id,p_fecha_inicio,p_fecha_fin,p_adultos,p_ninos,precio,coalesce(p_notas,''),p_estado) returning * into r;
   insert into facturas(reserva_id,monto_total,referencia_sistema_legado) values(r.id,total_reserva(r.id),'LEGACY-'||substr(r.id::text,1,8));
 else
   update reservas set habitacion_id=h.id,fecha_inicio=p_fecha_inicio,fecha_fin=p_fecha_fin,adultos=p_adultos,ninos=p_ninos,tarifa_noche=precio,notas=coalesce(p_notas,''),estado=p_estado,version=version+1 where id=anterior.id returning * into r;
   if saldo_pagado(r.id)>total_reserva(r.id) then raise exception 'Registra el reembolso antes de reducir el total'; end if;
   update facturas set monto_total=total_reserva(r.id),estado=case when saldo_pagado(r.id)>=total_reserva(r.id) then 'pagada' else 'pendiente' end where reserva_id=r.id;
 end if;
 return r;
end $$;
create or replace function fn_contratar_servicio(p_reserva_id uuid,p_servicio_id uuid,p_cantidad int) returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp set timezone='America/Santiago' as $$
declare r reservas; s servicios_adicionales;
begin
 select * into r from reservas where id=p_reserva_id for update;
 if r.id is null or not puede_operar(r.hotel_id) or r.estado not in ('pendiente','confirmada','check_in') then raise exception 'Reserva no disponible'; end if;
 if public.estado_vigente(r)='vencida' then raise exception 'La reserva está vencida; requiere regularización'; end if;
 select * into s from servicios_adicionales where id=p_servicio_id and activo for share;
 if s.id is null or s.hotel_id<>r.hotel_id then raise exception 'Servicio inválido para este hotel'; end if;
 insert into servicios_contratados(reserva_id,servicio_id,cantidad,precio_unitario) values(r.id,s.id,p_cantidad,s.precio);
 update facturas set monto_total=total_reserva(r.id),estado=case when saldo_pagado(r.id)>=total_reserva(r.id) then 'pagada' else 'pendiente' end where reserva_id=r.id;
 insert into eventos_reserva(reserva_id,tipo_evento,detalle) values(r.id,'servicio_contratado',jsonb_build_object('servicio',s.nombre,'cantidad',p_cantidad));
end $$;
create or replace function fn_estado_reserva(p_reserva_id uuid,p_estado text) returns reservas language plpgsql security definer set search_path=pg_catalog,public,pg_temp set timezone='America/Santiago' as $$
declare r reservas;
begin
 select * into r from reservas where id=p_reserva_id for update;
 if auth.uid() is null or r.id is null or not (puede_operar(r.hotel_id) or (mi_rol() is not distinct from 'cliente' and coalesce(r.cliente_id=auth.uid(),false) and p_estado='cancelada')) then raise exception 'No autorizado'; end if;
 if public.estado_vigente(r)='vencida' and not (r.estado='check_in' and p_estado='check_out') then raise exception 'La reserva está vencida; requiere regularización'; end if;
 if not ((r.estado='pendiente' and p_estado in ('confirmada','cancelada')) or (r.estado='confirmada' and p_estado in ('check_in','cancelada')) or (r.estado='check_in' and p_estado='check_out')) then raise exception 'Cambio de estado inválido'; end if;
 if p_estado='check_in' and (current_date<r.fecha_inicio or current_date>=r.fecha_fin) then raise exception 'Check-in fuera de las fechas de estancia'; end if;
 if p_estado='check_out' and saldo_pagado(r.id)<total_reserva(r.id) then raise exception 'Hay un saldo pendiente de pago'; end if;
 if p_estado='cancelada' and saldo_pagado(r.id)>0 then raise exception 'Registra el reembolso antes de cancelar'; end if;
 update reservas set estado=p_estado,version=version+1,entrada_en=case when p_estado='check_in' then now() else entrada_en end,salida_en=case when p_estado='check_out' then now() else salida_en end where id=r.id returning * into r;
 if p_estado='cancelada' then update facturas set estado='anulada' where reserva_id=r.id; end if;
 return r;
end $$;
create or replace function public.validar_cambio_habitacion() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp set timezone='America/Santiago' as $$
begin
 if exists(select 1 from public.reservas r where r.habitacion_id=new.id
 and (public.estado_vigente(r) in ('pendiente','confirmada','check_in') or r.estado='check_in')
 and (r.fecha_fin >= (now() at time zone 'America/Santiago')::date or r.estado='check_in')
 and (r.adultos+r.ninos>new.capacidad or new.estado<>'activa' or new.hotel_id<>old.hotel_id)) then
  raise exception 'Hay reservas activas incompatibles con el cambio de habitación';
 end if;
 return new;
end $$;
revoke all on function public.validar_cambio_habitacion() from public,anon,authenticated;
revoke all on function public.fn_guardar_reserva(uuid,date,date,int,int,uuid,uuid,int,text,text),public.fn_contratar_servicio(uuid,uuid,int),public.fn_estado_reserva(uuid,text) from public,anon;
grant execute on function public.fn_guardar_reserva(uuid,date,date,int,int,uuid,uuid,int,text,text),public.fn_contratar_servicio(uuid,uuid,int),public.fn_estado_reserva(uuid,text) to authenticated;
insert into public.migraciones_maremoto(version) values(16) on conflict do nothing;
notify pgrst,'reload schema';
commit;
