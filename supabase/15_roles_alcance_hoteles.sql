-- Incremental después de 14. No crea usuarios ni reasigna perfiles existentes.
begin;
lock table public.perfiles in share row exclusive mode;
do $$ begin
 if not exists(select 1 from public.migraciones_maremoto where version=14) then
  raise exception 'Ejecuta primero la migración 14';
 end if;
 if exists(select 1 from public.perfiles p where
   (p.rol in ('cliente','gerente_general') and p.hotel_id is not null)
   or (p.rol in ('gerente','recepcionista') and (p.hotel_id is null or not exists(select 1 from public.hoteles h where h.id=p.hotel_id)))
   or p.rol not in ('cliente','gerente_general','gerente','recepcionista')) then
  raise exception 'Hay perfiles con alcance incompatible. Revisa rol/hotel_id con el administrador antes de aplicar 15';
 end if;
end $$;
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check check(rol in ('cliente','recepcionista','gerente','gerente_general'));
alter table public.perfiles drop constraint if exists perfiles_alcance_hotel;
alter table public.perfiles add constraint perfiles_alcance_hotel check(
 (rol in ('cliente','gerente_general') and hotel_id is null)
 or (rol in ('gerente','recepcionista') and hotel_id is not null));
-- La FK existente perfiles.hotel_id -> hoteles.id valida el hotel real.
create or replace function public.puede_operar(p_hotel uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select coalesce(auth.uid() is not null and exists(
  select 1 from public.perfiles p join public.hoteles h on h.id=p_hotel
  where p.id=auth.uid() and (
   (p.rol='gerente_general' and p.hotel_id is null)
   or (p.rol in ('gerente','recepcionista') and p.hotel_id=p_hotel))),false);
$$;
revoke all on function public.puede_operar(uuid) from public,anon;
grant execute on function public.puede_operar(uuid) to authenticated;

drop policy if exists gerente_escribe_habitaciones on public.habitaciones;
create policy gerente_escribe_habitaciones on public.habitaciones for all to authenticated
 using(public.mi_rol() in ('gerente','gerente_general') and public.puede_operar(hotel_id))
 with check(public.mi_rol() in ('gerente','gerente_general') and public.puede_operar(hotel_id));
drop policy if exists gerente_recepcion_gestiona_servicios on public.servicios_adicionales;
create policy gerente_recepcion_gestiona_servicios on public.servicios_adicionales for all to authenticated
 using(public.puede_operar(hotel_id)) with check(public.puede_operar(hotel_id));
drop policy if exists hoteles_gestion on public.hoteles;
create policy hoteles_gestion on public.hoteles for update to authenticated
 using(public.mi_rol() in ('gerente','gerente_general') and public.puede_operar(id))
 with check(public.mi_rol() in ('gerente','gerente_general') and public.puede_operar(id));
drop policy if exists hoteles_alta on public.hoteles;
create policy hoteles_alta on public.hoteles for insert to authenticated
 with check(public.mi_rol()='gerente_general' and public.mi_hotel() is null);
drop policy if exists tipos_escritura on public.tipos_habitacion;
create policy tipos_escritura on public.tipos_habitacion for all to authenticated
 using(public.mi_rol()='gerente_general' and public.mi_hotel() is null)
 with check(public.mi_rol()='gerente_general' and public.mi_hotel() is null);
drop policy if exists auditoria_administracion on public.auditoria;
create policy auditoria_administracion on public.auditoria for select to authenticated
 using(public.mi_rol()='gerente_general' and public.mi_hotel() is null);
drop policy if exists paquetes_gerencia on public.paquetes;
create policy paquetes_gerencia on public.paquetes for select to authenticated
 using(public.mi_rol() in ('gerente','gerente_general') and public.puede_operar(hotel_id));
-- Las policies de reservas, huéspedes, pagos, facturas, eventos y perfiles de
-- clientes usan puede_operar: heredan el nuevo aislamiento sin ampliar grants.
-- Regiones y tipos son catálogos compartidos, no datos privados de hoteles.
-- Perfiles conservan UPDATE exclusivamente nombre/telefono; ninguna asignación
-- de roles se expone por RPC. Suscripciones y funciones internas siguen privadas.
create or replace function fn_guardar_paquete(p_datos jsonb,p_servicios jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_id uuid:=coalesce(nullif(p_datos->>'id','')::uuid,gen_random_uuid()); v_hotel uuid:=(p_datos->>'hotel_id')::uuid; anterior paquetes;
begin
 if jsonb_typeof(p_datos) is distinct from 'object' or jsonb_typeof(p_servicios) is distinct from 'array' then raise exception 'Datos de paquete inválidos'; end if;
 if coalesce(mi_rol() in ('gerente','gerente_general'),false) is not true or not puede_operar(v_hotel) then raise exception 'Gestión de paquetes restringida a gerencia del hotel'; end if;
 select * into anterior from paquetes where id=v_id for update;
 if anterior.id is not null and anterior.hotel_id<>v_hotel then raise exception 'No se puede cambiar el hotel de un paquete'; end if;
 if length(trim(p_datos->>'nombre')) not between 2 and 150 or (p_datos->>'capacidad')::int<(p_datos->>'min_adultos')::int
 or (nullif(p_datos->>'vigente_desde','')::date>nullif(p_datos->>'vigente_hasta','')::date) then raise exception 'Revisa nombre, capacidad y vigencia'; end if;
 if not exists(select 1 from habitaciones where hotel_id=v_hotel and tipo=p_datos->>'tipo') then raise exception 'El hotel no tiene esa categoría'; end if;
 if coalesce(p_datos->>'imagen_url','')<>'' and not (p_datos->>'imagen_url' ~ '^https://' or p_datos->>'imagen_url' ~ '^/images/hoteles/[a-zA-Z0-9-]+\.(jpg|png|webp)$') then raise exception 'URL de portada inválida'; end if;
 insert into paquetes(id,hotel_id,nombre,descripcion,noches,tipo,activo,imagen_url,destacado,experiencia,capacidad,min_huespedes,min_adultos,max_ninos,precio,precio_referencial,condiciones,no_incluye,vigente_desde,vigente_hasta)
 values(v_id,v_hotel,trim(p_datos->>'nombre'),p_datos->>'descripcion',(p_datos->>'noches')::int,p_datos->>'tipo',(p_datos->>'activo')::boolean,coalesce(p_datos->>'imagen_url',''),(p_datos->>'destacado')::boolean,p_datos->>'experiencia',(p_datos->>'capacidad')::int,coalesce((p_datos->>'min_huespedes')::int,anterior.min_huespedes,1),(p_datos->>'min_adultos')::int,(p_datos->>'max_ninos')::int,(p_datos->>'precio')::numeric,nullif(p_datos->>'precio_referencial','')::numeric,coalesce(p_datos->>'condiciones',''),coalesce(p_datos->>'no_incluye',''),nullif(p_datos->>'vigente_desde','')::date,nullif(p_datos->>'vigente_hasta','')::date)
 on conflict(id) do update set nombre=excluded.nombre,descripcion=excluded.descripcion,noches=excluded.noches,tipo=excluded.tipo,activo=excluded.activo,imagen_url=excluded.imagen_url,destacado=excluded.destacado,experiencia=excluded.experiencia,capacidad=excluded.capacidad,min_huespedes=excluded.min_huespedes,min_adultos=excluded.min_adultos,max_ninos=excluded.max_ninos,precio=excluded.precio,precio_referencial=excluded.precio_referencial,condiciones=excluded.condiciones,no_incluye=excluded.no_incluye,vigente_desde=excluded.vigente_desde,vigente_hasta=excluded.vigente_hasta;
 -- Cambiar composición no altera servicios ya contratados ni snapshots.
 delete from paquete_servicios where paquete_id=v_id;
 if exists(select 1 from jsonb_to_recordset(p_servicios) as x(servicio_id uuid,cantidad int) left join servicios_adicionales s on s.id=x.servicio_id where s.id is null or s.hotel_id<>v_hotel or not s.activo or x.cantidad is null or x.cantidad<1) then raise exception 'Los servicios deben estar activos y pertenecer al hotel'; end if;
 insert into paquete_servicios(paquete_id,hotel_id,servicio_id,cantidad) select v_id,v_hotel,x.servicio_id,x.cantidad from jsonb_to_recordset(p_servicios) as x(servicio_id uuid,cantidad int);
 return v_id;
end $$;
revoke all on function public.fn_guardar_paquete(jsonb,jsonb) from public,anon;
grant execute on function public.fn_guardar_paquete(jsonb,jsonb) to authenticated;
-- El acceso personal a reservas corresponde exclusivamente al rol cliente.
drop policy if exists cliente_ve_sus_reservas on public.reservas;
create policy cliente_ve_sus_reservas on public.reservas for select to authenticated
 using(public.mi_rol()='cliente' and cliente_id=auth.uid());
create or replace function fn_estado_reserva(p_reserva_id uuid,p_estado text) returns reservas language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare r reservas;
begin
 select * into r from reservas where id=p_reserva_id for update;
 if auth.uid() is null or r.id is null or not (puede_operar(r.hotel_id) or (mi_rol() is not distinct from 'cliente' and coalesce(r.cliente_id=auth.uid(),false) and p_estado='cancelada')) then raise exception 'No autorizado'; end if;
 if not ((r.estado='pendiente' and p_estado in ('confirmada','cancelada')) or (r.estado='confirmada' and p_estado in ('check_in','cancelada')) or (r.estado='check_in' and p_estado='check_out')) then raise exception 'Cambio de estado inválido'; end if;
 if p_estado='check_in' and (current_date<r.fecha_inicio or current_date>=r.fecha_fin) then raise exception 'Check-in fuera de las fechas de estancia'; end if;
 if p_estado='check_out' and saldo_pagado(r.id)<total_reserva(r.id) then raise exception 'Hay un saldo pendiente de pago'; end if;
 if p_estado='cancelada' and saldo_pagado(r.id)>0 then raise exception 'Registra el reembolso antes de cancelar'; end if;
 update reservas set estado=p_estado,version=version+1,entrada_en=case when p_estado='check_in' then now() else entrada_en end,salida_en=case when p_estado='check_out' then now() else salida_en end where id=r.id returning * into r;
 if p_estado='cancelada' then update facturas set estado='anulada' where reserva_id=r.id; end if;
 return r;
end $$;
-- Disponibilidad operativa: el cliente busca en cualquier hotel; el personal
-- no obtiene el inventario operativo de hoteles fuera de su alcance.
create or replace function public.fn_disponibilidad(p_hotel_id uuid,p_fecha_inicio date,p_fecha_fin date,p_tipo text default null) returns setof public.habitaciones
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 if public.mi_rol() is distinct from 'cliente' and not public.puede_operar(p_hotel_id) then raise exception 'No autorizado para este hotel'; end if;
 if p_fecha_inicio is null or p_fecha_fin is null or p_fecha_inicio<current_date or p_fecha_fin<=p_fecha_inicio then raise exception 'Fechas inválidas'; end if;
 return query select h.* from public.habitaciones h join public.hoteles ht on ht.id=h.hotel_id where ht.estado='activo' and h.hotel_id=p_hotel_id and h.estado='activa' and (p_tipo is null or h.tipo=p_tipo) and not exists(select 1 from public.reservas r where r.habitacion_id=h.id and r.estado in ('pendiente','confirmada','check_in') and daterange(r.fecha_inicio,r.fecha_fin,'[)') && daterange(p_fecha_inicio,p_fecha_fin,'[)'));
end $$;
create or replace function public.fn_sugerir_alternativas(p_hotel_id_original uuid,p_fecha_inicio date,p_fecha_fin date,p_tipo text default null)
returns table(hotel_id uuid,hotel_nombre text,habitacion_id uuid,numero text,tipo text,precio_noche numeric)
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare destino record;
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 if public.mi_rol() is distinct from 'cliente' and not public.puede_operar(p_hotel_id_original) then raise exception 'No autorizado para este hotel'; end if;
 for destino in select ht.id,ht.nombre from public.hoteles ht where ht.region_id=(select region_id from public.hoteles where id=p_hotel_id_original) and ht.id<>p_hotel_id_original and (public.mi_rol()='cliente' or public.puede_operar(ht.id)) loop
  return query select destino.id,destino.nombre,h.id,h.numero,h.tipo,h.precio_noche from public.fn_disponibilidad(destino.id,p_fecha_inicio,p_fecha_fin,p_tipo) h;
 end loop;
end $$;
revoke all on function public.fn_estado_reserva(uuid,text),public.fn_disponibilidad(uuid,date,date,text),public.fn_sugerir_alternativas(uuid,date,date,text) from public,anon;
grant execute on function public.fn_estado_reserva(uuid,text),public.fn_disponibilidad(uuid,date,date,text),public.fn_sugerir_alternativas(uuid,date,date,text) to authenticated;
insert into public.migraciones_maremoto(version) values(15) on conflict do nothing;
notify pgrst,'reload schema';
commit;
