-- Ampliación no destructiva e idempotente. Ejecutar después de 01–06.
begin;
create table if not exists migraciones_maremoto(version integer primary key, aplicada_en timestamptz default now());
do $migration$ begin
  if exists(select 1 from migraciones_maremoto where version=7) then
    return;
  end if;
alter function mi_rol() set search_path = public;
alter function mi_hotel() set search_path = public;
alter function fn_auditar() set search_path = public;
alter function fn_registrar_evento_reserva() set search_path = public;

create function puede_operar(p_hotel uuid) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(auth.uid() is not null and mi_rol() in ('gerente','recepcionista') and (mi_hotel()=p_hotel or (mi_rol()='gerente' and mi_hotel() is null)),false);
$$;
alter table hoteles add column descripcion text not null default '', add column servicios text[] not null default '{}', add column estado text not null default 'activo' check(estado in ('activo','inactivo'));
create table tipos_habitacion(codigo text primary key, nombre text not null, descripcion text not null default '');
insert into tipos_habitacion(codigo,nombre) values ('individual','Individual'),('doble','Doble'),('suite','Suite'),('familiar','Familiar');
alter table habitaciones drop constraint habitaciones_tipo_check;
alter table habitaciones add foreign key(tipo) references tipos_habitacion(codigo), add column caracteristicas text not null default '';
alter table habitaciones add constraint capacidad_positiva check(capacidad>0) not valid;
create unique index habitaciones_id_hotel on habitaciones(id,hotel_id);
-- NOT VALID conserva posibles inconsistencias antiguas y protege nuevas escrituras.
alter table reservas add constraint reserva_hotel_habitacion foreign key(habitacion_id,hotel_id) references habitaciones(id,hotel_id) not valid;

create table huespedes(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references hoteles(id),
 nombre text not null check(length(trim(nombre)) between 2 and 150), documento text not null check(length(trim(documento))>2),
 email text, telefono text, notas text not null default '', creado_en timestamptz not null default now(),
 unique(hotel_id,documento)
);
create unique index huesped_id_hotel on huespedes(id,hotel_id);
alter table reservas alter column cliente_id drop not null;
alter table reservas add column huesped_id uuid references huespedes(id),
 add column adultos int not null default 1 check(adultos>0), add column ninos int not null default 0 check(ninos>=0),
 add column tarifa_noche numeric(12,2) check(tarifa_noche>=0),
 add column notas text not null default '', add column entrada_en timestamptz, add column salida_en timestamptz,
 add column version int not null default 1,
 add constraint reserva_titular check(cliente_id is not null or huesped_id is not null);
alter table reservas add constraint reserva_huesped_hotel foreign key(huesped_id,hotel_id) references huespedes(id,hotel_id);
-- Recuperar tarifa desde factura cuando existe; no alterar importes históricos.
update reservas r set tarifa_noche=coalesce((select sum(f.monto_total)/(r.fecha_fin-r.fecha_inicio) from facturas f where f.reserva_id=r.id),h.precio_noche)
 from habitaciones h where h.id=r.habitacion_id;
alter table reservas alter column tarifa_noche set not null;
alter table reservas drop constraint reservas_estado_check;
alter table reservas add constraint reservas_estado_check check(estado in ('pendiente','confirmada','check_in','check_out','cancelada'));
alter table reservas drop constraint reservas_habitacion_id_daterange_excl;
alter table reservas add constraint reservas_sin_solapamiento exclude using gist(habitacion_id with =, daterange(fecha_inicio,fecha_fin,'[)') with &&) where(estado in ('pendiente','confirmada','check_in'));
create index reservas_fechas on reservas(hotel_id,fecha_inicio,fecha_fin);
create index reservas_huesped on reservas(huesped_id);
create index eventos_reserva_fecha on eventos_reserva(reserva_id,creado_en desc);
create index servicios_reserva on servicios_contratados(reserva_id);
create index facturas_reserva on facturas(reserva_id);
alter table servicios_contratados add column precio_unitario numeric(12,2);
update servicios_contratados c set precio_unitario=s.precio from servicios_adicionales s where s.id=c.servicio_id;
alter table servicios_contratados alter column precio_unitario set not null;
alter table servicios_contratados add check(precio_unitario>=0);

create table pagos(
 id uuid primary key default gen_random_uuid(), reserva_id uuid not null references reservas(id),
 monto numeric(12,2) not null check(monto>0), tipo text not null check(tipo in ('pago','reembolso')),
 metodo text not null check(metodo in ('efectivo','tarjeta','transferencia')),
 referencia text not null default '', idempotencia uuid not null unique,
 registrado_por uuid references perfiles(id), creado_en timestamptz not null default now()
);
create index pagos_reserva on pagos(reserva_id);
create trigger auditar_pagos after insert on pagos for each row execute function fn_auditar();

create function total_reserva(p_id uuid) returns numeric language sql stable security definer set search_path=public as $$
 select (fecha_fin-fecha_inicio)*tarifa_noche+coalesce((select sum(c.cantidad*c.precio_unitario) from servicios_contratados c where c.reserva_id=r.id),0) from reservas r where r.id=p_id;
$$;
create function saldo_pagado(p_id uuid) returns numeric language sql stable security definer set search_path=public as $$
 select coalesce(sum(case when tipo='pago' then monto else -monto end),0) from pagos where reserva_id=p_id;
$$;
-- Helpers internos sin acceso RPC; los importes se exponen mediante las relaciones RLS.
revoke all on function total_reserva(uuid), saldo_pagado(uuid) from public,anon,authenticated;

-- El navegador no puede saltarse las transacciones de negocio.
revoke insert,update,delete on reservas, facturas, servicios_contratados, pagos from anon,authenticated;
revoke update on perfiles from anon,authenticated;
grant update(nombre,telefono) on perfiles to authenticated;
drop policy actualizar_mi_perfil on perfiles;
create policy actualizar_mi_perfil on perfiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
drop policy personal_ve_eventos on eventos_reserva;
create policy eventos_por_hotel on eventos_reserva for select to authenticated using(exists(select 1 from reservas r where r.id=reserva_id and (r.cliente_id=auth.uid() or puede_operar(r.hotel_id))));
drop policy gerente_ve_auditoria on auditoria;
create policy auditoria_administracion on auditoria for select to authenticated using(mi_rol()='gerente' and mi_hotel() is null);
drop policy personal_ve_clientes on perfiles;
create policy personal_ve_clientes on perfiles for select to authenticated using(rol='cliente' and exists(select 1 from reservas r where r.cliente_id=perfiles.id and puede_operar(r.hotel_id)));
alter table huespedes enable row level security;
alter table pagos enable row level security;
alter table tipos_habitacion enable row level security;
alter table migraciones_maremoto enable row level security;
create policy huespedes_hotel on huespedes for all to authenticated using(puede_operar(hotel_id)) with check(puede_operar(hotel_id));
create policy pagos_lectura on pagos for select to authenticated using(exists(select 1 from reservas r where r.id=reserva_id and (r.cliente_id=auth.uid() or puede_operar(r.hotel_id))));
create policy tipos_lectura on tipos_habitacion for select to authenticated using(true);
create policy tipos_escritura on tipos_habitacion for all to authenticated using(mi_rol()='gerente' and mi_hotel() is null) with check(mi_rol()='gerente' and mi_hotel() is null);
create policy hoteles_gestion on hoteles for update to authenticated using(mi_rol()='gerente' and puede_operar(id)) with check(mi_rol()='gerente' and puede_operar(id));
create policy hoteles_alta on hoteles for insert to authenticated with check(mi_rol()='gerente' and mi_hotel() is null);
grant select,insert,update on huespedes,tipos_habitacion to authenticated;
grant select on pagos to authenticated;
grant insert,update on hoteles to authenticated;

create function fn_guardar_reserva(p_habitacion_id uuid,p_fecha_inicio date,p_fecha_fin date,p_adultos int default 1,p_ninos int default 0,p_huesped_id uuid default null,p_reserva_id uuid default null,p_version int default null,p_notas text default '',p_estado text default 'confirmada')
returns reservas language plpgsql security definer set search_path=public as $$
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

create or replace function fn_crear_reserva(p_habitacion_id uuid,p_fecha_inicio date,p_fecha_fin date) returns reservas language plpgsql security definer set search_path=public as $$
begin return fn_guardar_reserva(p_habitacion_id,p_fecha_inicio,p_fecha_fin); end $$;

create function fn_estado_reserva(p_reserva_id uuid,p_estado text) returns reservas language plpgsql security definer set search_path=public as $$
declare r reservas;
begin
 select * into r from reservas where id=p_reserva_id for update;
 if auth.uid() is null or r.id is null or not (puede_operar(r.hotel_id) or (coalesce(r.cliente_id=auth.uid(),false) and p_estado='cancelada')) then raise exception 'No autorizado'; end if;
 if not ((r.estado='pendiente' and p_estado in ('confirmada','cancelada')) or (r.estado='confirmada' and p_estado in ('check_in','cancelada')) or (r.estado='check_in' and p_estado='check_out')) then raise exception 'Cambio de estado inválido'; end if;
 if p_estado='check_in' and (current_date<r.fecha_inicio or current_date>=r.fecha_fin) then raise exception 'Check-in fuera de las fechas de estancia'; end if;
 if p_estado='check_out' and saldo_pagado(r.id)<total_reserva(r.id) then raise exception 'Hay un saldo pendiente de pago'; end if;
 if p_estado='cancelada' and saldo_pagado(r.id)>0 then raise exception 'Registra el reembolso antes de cancelar'; end if;
 update reservas set estado=p_estado,version=version+1,entrada_en=case when p_estado='check_in' then now() else entrada_en end,salida_en=case when p_estado='check_out' then now() else salida_en end where id=r.id returning * into r;
 if p_estado='cancelada' then update facturas set estado='anulada' where reserva_id=r.id; end if;
 return r;
end $$;
create or replace function fn_checkin(p_reserva_id uuid) returns reservas language sql security definer set search_path=public as $$ select fn_estado_reserva(p_reserva_id,'check_in'); $$;
create or replace function fn_checkout(p_reserva_id uuid) returns reservas language sql security definer set search_path=public as $$ select fn_estado_reserva(p_reserva_id,'check_out'); $$;
create or replace function fn_cancelar_reserva(p_reserva_id uuid) returns reservas language sql security definer set search_path=public as $$ select fn_estado_reserva(p_reserva_id,'cancelada'); $$;

create function fn_registrar_pago(p_reserva_id uuid,p_monto numeric,p_metodo text,p_idempotencia uuid,p_tipo text default 'pago',p_referencia text default '') returns pagos language plpgsql security definer set search_path=public as $$
declare r reservas; resultado pagos; abonado numeric;
begin
 select * into r from reservas where id=p_reserva_id for update;
 if r.id is null or not puede_operar(r.hotel_id) then raise exception 'No autorizado'; end if;
 select * into resultado from pagos where idempotencia=p_idempotencia;
 if resultado.id is not null then
   if resultado.reserva_id<>p_reserva_id or resultado.monto<>p_monto or resultado.tipo<>p_tipo or resultado.metodo<>p_metodo then raise exception 'La referencia de operación ya fue utilizada'; end if;
   return resultado;
 end if;
 abonado:=saldo_pagado(r.id);
 if p_monto is null or p_monto<=0 or round(p_monto,2)<>p_monto or p_tipo is null or p_tipo not in ('pago','reembolso') then raise exception 'Monto o tipo inválido'; end if;
 if (p_tipo='pago' and (r.estado in ('cancelada','check_out') or p_monto>total_reserva(r.id)-abonado)) or (p_tipo='reembolso' and (r.estado='check_out' or p_monto>abonado)) then raise exception 'El importe supera el saldo permitido'; end if;
 insert into pagos(reserva_id,monto,tipo,metodo,referencia,idempotencia,registrado_por) values(r.id,p_monto,p_tipo,p_metodo,coalesce(p_referencia,''),p_idempotencia,auth.uid()) returning * into resultado;
 update facturas set estado=case when saldo_pagado(r.id)>=total_reserva(r.id) then 'pagada' else 'pendiente' end where reserva_id=r.id;
 return resultado;
end $$;

create function fn_contratar_servicio(p_reserva_id uuid,p_servicio_id uuid,p_cantidad int) returns void language plpgsql security definer set search_path=public as $$
declare r reservas; s servicios_adicionales;
begin
 select * into r from reservas where id=p_reserva_id for update;
 if r.id is null or not puede_operar(r.hotel_id) or r.estado not in ('pendiente','confirmada','check_in') then raise exception 'Reserva no disponible'; end if;
 select * into s from servicios_adicionales where id=p_servicio_id and activo for share;
 if s.id is null or s.hotel_id<>r.hotel_id then raise exception 'Servicio inválido para este hotel'; end if;
 insert into servicios_contratados(reserva_id,servicio_id,cantidad,precio_unitario) values(r.id,s.id,p_cantidad,s.precio);
 update facturas set monto_total=total_reserva(r.id),estado=case when saldo_pagado(r.id)>=total_reserva(r.id) then 'pagada' else 'pendiente' end where reserva_id=r.id;
 insert into eventos_reserva(reserva_id,tipo_evento,detalle) values(r.id,'servicio_contratado',jsonb_build_object('servicio',s.nombre,'cantidad',p_cantidad));
end $$;

create or replace function fn_disponibilidad(p_hotel_id uuid,p_fecha_inicio date,p_fecha_fin date,p_tipo text default null) returns setof habitaciones language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 if p_fecha_inicio is null or p_fecha_fin is null or p_fecha_inicio<current_date or p_fecha_fin<=p_fecha_inicio then raise exception 'Fechas inválidas'; end if;
 return query select h.* from habitaciones h join hoteles ht on ht.id=h.hotel_id where ht.estado='activo' and h.hotel_id=p_hotel_id and h.estado='activa' and (p_tipo is null or h.tipo=p_tipo) and not exists(select 1 from reservas r where r.habitacion_id=h.id and r.estado in ('pendiente','confirmada','check_in') and daterange(r.fecha_inicio,r.fecha_fin,'[)') && daterange(p_fecha_inicio,p_fecha_fin,'[)'));
end $$;
create or replace function fn_sugerir_alternativas(p_hotel_id_original uuid,p_fecha_inicio date,p_fecha_fin date,p_tipo text default null) returns table(hotel_id uuid,hotel_nombre text,habitacion_id uuid,numero text,tipo text,precio_noche numeric) language sql stable security definer set search_path=public as $$
 select ht.id,ht.nombre,h.id,h.numero,h.tipo,h.precio_noche from hoteles ht cross join lateral fn_disponibilidad(ht.id,p_fecha_inicio,p_fecha_fin,p_tipo) h where ht.region_id=(select region_id from hoteles where id=p_hotel_id_original) and ht.id<>p_hotel_id_original order by h.precio_noche;
$$;

-- Crear perfil también cuando Supabase requiere confirmación de correo.
create function fn_perfil_registro() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.raw_user_meta_data->>'rut' is not null then
   insert into perfiles(id,rut,nombre,telefono,rol) values(new.id,new.raw_user_meta_data->>'rut',new.raw_user_meta_data->>'nombre',new.raw_user_meta_data->>'telefono','cliente');
 end if;
 return new;
end $$;
create trigger perfil_registro after insert on auth.users for each row execute function fn_perfil_registro();

-- Cerrar ejecución anónima de todas las funciones de negocio y fijar permisos.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as firma from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'fn_%' or p.proname in ('puede_operar','mi_rol','mi_hotel')) loop
  execute format('revoke all on function %s from public,anon',f.firma);
  execute format('grant execute on function %s to authenticated',f.firma);
 end loop;
end $$;
-- Fecha operativa consistente con la interfaz chilena, incluso con servidor UTC.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as firma from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'fn_%' loop
  execute format('alter function %s set timezone = %L',f.firma,'America/Santiago');
 end loop;
end $$;

create function validar_cambio_habitacion() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from reservas where habitacion_id=new.id and estado in ('pendiente','confirmada','check_in') and (fecha_fin >= (now() at time zone 'America/Santiago')::date or estado='check_in') and (adultos+ninos>new.capacidad or new.estado<>'activa' or new.hotel_id<>old.hotel_id)) then
   raise exception 'Hay reservas activas incompatibles con el cambio de habitación';
 end if;
 return new;
end $$;
revoke all on function validar_cambio_habitacion() from public,anon,authenticated;
create trigger validar_cambio_habitacion before update on habitaciones for each row execute function validar_cambio_habitacion();
alter table hoteles add constraint hotel_nombre_valido check(length(trim(nombre)) between 2 and 150) not valid;
alter table habitaciones add constraint numero_valido check(length(trim(numero)) between 1 and 30) not valid;
alter table servicios_adicionales add constraint servicio_nombre_valido check(length(trim(nombre)) between 2 and 150) not valid;
alter table perfiles add constraint perfil_nombre_valido check(length(trim(nombre)) between 2 and 150) not valid;
insert into migraciones_maremoto(version) values(7);
end $migration$;
notify pgrst, 'reload schema';
commit;
