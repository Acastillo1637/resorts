-- Requiere 12. Amplía las tablas existentes; no modifica 07/10/11/12.
begin;
do $$ begin if not exists(select 1 from migraciones_maremoto where version=12) then raise exception 'Ejecuta primero la migración 12'; end if; end $$;
alter table paquetes add column if not exists imagen_url text not null default '';
alter table paquetes add column if not exists destacado boolean not null default false;
alter table paquetes add column if not exists experiencia text not null default 'Escapada';
alter table paquetes add column if not exists capacidad int not null default 2 check(capacidad>0);
alter table paquetes add column if not exists min_adultos int not null default 1 check(min_adultos>0);
alter table paquetes add column if not exists max_ninos int not null default 1 check(max_ninos>=0);
alter table paquetes add column if not exists precio numeric(12,2) check(precio>=0);
alter table paquetes add column if not exists precio_referencial numeric(12,2) check(precio_referencial>=0);
alter table paquetes add column if not exists condiciones text not null default '';
alter table paquetes add column if not exists no_incluye text not null default '';
alter table paquetes add column if not exists vigente_desde date;
alter table paquetes add column if not exists vigente_hasta date;
alter table paquetes add column if not exists version int not null default 1;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.paquetes'::regclass and conname='paquete_restricciones_validas') then
   alter table paquetes add constraint paquete_restricciones_validas check(capacidad>=min_adultos and (vigente_desde is null or vigente_hasta is null or vigente_desde<=vigente_hasta));
 end if;
end $$;
alter table reservas add column if not exists paquete_precio_contratado numeric(12,2) check(paquete_precio_contratado>=0);
alter table reservas add column if not exists paquete_snapshot jsonb;
alter table servicios_contratados add column if not exists incluido_paquete boolean not null default false;
alter table servicios_contratados add column if not exists nombre_contratado text;
-- Solo completar productos antiguos sin precio; no cambiar precios al repetir.
update paquetes p set precio=coalesce((select min(r.precio_noche)*p.noches from habitaciones r where r.hotel_id=p.hotel_id and r.tipo=p.tipo and r.estado='activa'),0)
 +coalesce((select sum(ps.cantidad*s.precio) from paquete_servicios ps join servicios_adicionales s on s.id=ps.servicio_id where ps.paquete_id=p.id),0) where precio is null;
alter table paquetes alter column precio set not null;
-- Capturar el nombre y composición anteriores sin cambiar importes ni facturas.
update reservas r set paquete_snapshot=jsonb_build_object('nombre',p.nombre,'descripcion',p.descripcion,'noches',r.fecha_fin-r.fecha_inicio,'tipo',p.tipo,'precio',(r.fecha_fin-r.fecha_inicio)*r.tarifa_noche+coalesce((select sum(c.cantidad*c.precio_unitario) from servicios_contratados c where c.reserva_id=r.id),0),'servicios',coalesce((select jsonb_agg(jsonb_build_object('nombre',s.nombre,'cantidad',c.cantidad,'precio',c.precio_unitario)) from servicios_contratados c join servicios_adicionales s on s.id=c.servicio_id where c.reserva_id=r.id),'[]'::jsonb)) from paquetes p where r.paquete_id=p.id and r.paquete_snapshot is null;
update servicios_contratados c set nombre_contratado=s.nombre from servicios_adicionales s where c.servicio_id=s.id and c.nombre_contratado is null;
create or replace function paquete_valido(p_id uuid,p_inicio date,p_adultos int,p_ninos int) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce(p.activo and h.estado='activo' and h.reservable and p_inicio>=(now() at time zone 'America/Santiago')::date
 and p_adultos>=p.min_adultos and p_ninos>=0 and p_ninos<=p.max_ninos and p_adultos+p_ninos<=p.capacidad
 and (p.vigente_desde is null or p_inicio>=p.vigente_desde)
 and (p.vigente_hasta is null or p_inicio+p.noches-1<=p.vigente_hasta)
 and not exists(select 1 from paquete_servicios ps join servicios_adicionales s on s.id=ps.servicio_id where ps.paquete_id=p.id and (not s.activo or s.hotel_id<>p.hotel_id)),false)
 from paquetes p join hoteles h on h.id=p.hotel_id where p.id=p_id;
$$;
revoke all on function paquete_valido(uuid,date,int,int) from public,anon,authenticated;
create or replace function fn_paquetes_publicos() returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('dias',p.noches+1,
 'hotel',jsonb_build_object('nombre',h.nombre,'ubicacion',h.direccion,'zona',h.zona,'slug',coalesce(h.slug,h.id::text),'imagen_url',h.imagen_url,'imagen_ambiente',h.imagen_ambiente,'inventario_demo',h.inventario_demo),
 'servicios',(select coalesce(jsonb_agg(jsonb_build_object('servicio_id',s.id,'nombre',s.nombre,'descripcion',s.descripcion,'cantidad',ps.cantidad,'precio',s.precio)),'[]'::jsonb) from paquete_servicios ps join servicios_adicionales s on s.id=ps.servicio_id where ps.paquete_id=p.id)
 ) order by p.destacado desc,p.nombre),'[]'::jsonb) from paquetes p join hoteles h on h.id=p.hotel_id
 where p.activo and h.estado='activo' and h.reservable and (p.vigente_hasta is null or p.vigente_hasta>=(now() at time zone 'America/Santiago')::date)
 and exists(select 1 from habitaciones r where r.hotel_id=p.hotel_id and r.tipo=p.tipo and r.estado='activa' and r.capacidad>=p.min_adultos)
 and not exists(select 1 from paquete_servicios ps join servicios_adicionales s on s.id=ps.servicio_id where ps.paquete_id=p.id and not s.activo);
$$;
revoke all on function fn_paquetes_publicos() from public;
grant execute on function fn_paquetes_publicos() to anon,authenticated;
-- Disponibilidad pública únicamente del inventario, nunca de reservas/datos personales.
create or replace function fn_disponibilidad_paquete(p_paquete_id uuid,p_fecha_inicio date,p_adultos int default 1,p_ninos int default 0) returns setof habitaciones
language plpgsql stable security definer set search_path=public set timezone='America/Santiago' as $$
declare p paquetes;
begin
 if paquete_valido(p_paquete_id,p_fecha_inicio,p_adultos,p_ninos) is distinct from true then raise exception 'Revisa vigencia, huéspedes y servicios del paquete'; end if;
 select * into p from paquetes where id=p_paquete_id;
 return query select r.* from habitaciones r where r.hotel_id=p.hotel_id and r.tipo=p.tipo and r.estado='activa' and r.capacidad>=p_adultos+p_ninos
 and not exists(select 1 from reservas b where b.habitacion_id=r.id and b.estado in ('pendiente','confirmada','check_in') and daterange(b.fecha_inicio,b.fecha_fin,'[)') && daterange(p_fecha_inicio,p_fecha_inicio+p.noches,'[)')) order by r.numero;
end $$;
revoke all on function fn_disponibilidad_paquete(uuid,date,int,int) from public;
grant execute on function fn_disponibilidad_paquete(uuid,date,int,int) to anon,authenticated;
-- Mantiene los totales de reservas normales y paquetes antiguos; los nuevos fijan precio.
create or replace function total_reserva(p_id uuid) returns numeric language sql stable security definer set search_path=public as $$
 select coalesce(r.paquete_precio_contratado,(r.fecha_fin-r.fecha_inicio)*r.tarifa_noche)
 +coalesce((select sum(c.cantidad*c.precio_unitario) from servicios_contratados c where c.reserva_id=r.id and (r.paquete_precio_contratado is null or not c.incluido_paquete)),0) from reservas r where r.id=p_id;
$$;
revoke all on function total_reserva(uuid) from public,anon,authenticated;
drop function if exists fn_reservar_paquete(uuid,uuid,date,int,int);
create or replace function fn_reservar_paquete(p_paquete_id uuid,p_habitacion_id uuid,p_fecha_inicio date,p_adultos int default 1,p_ninos int default 0,p_version int default null)
returns reservas language plpgsql security definer set search_path=public set timezone='America/Santiago' as $$
declare p paquetes; h habitaciones; r reservas; servicios jsonb; item record;
begin
 if auth.uid() is null or mi_rol() is distinct from 'cliente' then raise exception 'Inicia sesión como huésped'; end if;
 select * into p from paquetes where id=p_paquete_id for share;
 if p_version is not null and p.version is distinct from p_version then raise exception 'El paquete cambió. Actualiza la ficha antes de reservar'; end if;
 if p.id is null or paquete_valido(p.id,p_fecha_inicio,p_adultos,p_ninos) is distinct from true then raise exception 'Paquete no disponible para estas fechas o huéspedes'; end if;
 select * into h from habitaciones where id=p_habitacion_id for update;
 if h.id is null or h.hotel_id<>p.hotel_id or h.tipo<>p.tipo then raise exception 'Habitación incompatible con el paquete'; end if;
 -- El guardado existente valida capacidad, estado, fechas y exclusión de solapamientos.
 r:=fn_guardar_reserva(h.id,p_fecha_inicio,p_fecha_inicio+p.noches,p_adultos,p_ninos);
 servicios:='[]'::jsonb;
 for item in select ps.*,s.precio,s.nombre,s.descripcion,s.activo from paquete_servicios ps join servicios_adicionales s on s.id=ps.servicio_id where ps.paquete_id=p.id for share of ps,s loop
   if not item.activo or item.hotel_id<>p.hotel_id then raise exception 'Servicio no disponible'; end if;
   insert into servicios_contratados(reserva_id,servicio_id,cantidad,precio_unitario,incluido_paquete,nombre_contratado) values(r.id,item.servicio_id,item.cantidad,item.precio,true,item.nombre);
   servicios:=servicios||jsonb_build_array(jsonb_build_object('servicio_id',item.servicio_id,'nombre',item.nombre,'descripcion',item.descripcion,'cantidad',item.cantidad,'precio',item.precio));
 end loop;
 update reservas set paquete_id=p.id,paquete_precio_contratado=p.precio,
 paquete_snapshot=jsonb_build_object('nombre',p.nombre,'descripcion',p.descripcion,'noches',p.noches,'tipo',p.tipo,'precio',p.precio,'precio_referencial',p.precio_referencial,'condiciones',p.condiciones,'no_incluye',p.no_incluye,'servicios',servicios)
 where id=r.id returning * into r;
 update facturas set monto_total=total_reserva(r.id) where reserva_id=r.id;
 return r;
end $$;
revoke all on function fn_reservar_paquete(uuid,uuid,date,int,int,int) from public,anon;
grant execute on function fn_reservar_paquete(uuid,uuid,date,int,int,int) to authenticated;
create or replace function versionar_paquete() returns trigger language plpgsql set search_path=public as $$ begin new.version:=old.version+1; return new; end $$;
revoke all on function versionar_paquete() from public,anon,authenticated;
drop trigger if exists versionar_paquete on paquetes;
create trigger versionar_paquete before update on paquetes for each row execute function versionar_paquete();
create or replace function validar_hotel_reservable() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_OP='INSERT' and not exists(select 1 from hoteles where id=new.hotel_id and reservable) then raise exception 'Hotel no habilitado para reservas'; end if;
 if TG_OP='UPDATE' and old.paquete_id is not null and (
 new.habitacion_id<>old.habitacion_id or new.fecha_inicio<>old.fecha_inicio or new.fecha_fin<>old.fecha_fin or new.adultos<>old.adultos or new.ninos<>old.ninos
 or new.paquete_id is distinct from old.paquete_id or new.paquete_precio_contratado is distinct from old.paquete_precio_contratado or new.paquete_snapshot is distinct from old.paquete_snapshot
 ) then raise exception 'El contrato de paquete no puede modificarse; cancela y crea otra reserva'; end if;
 return new;
end $$;
-- RLS: público activo; gerentes de su hotel pueden leer borradores. Escritura solo RPC.
grant select on paquetes,paquete_servicios to anon,authenticated;
drop policy if exists paquetes_publicos on paquetes;
create policy paquetes_publicos on paquetes for select to anon,authenticated using(activo and (vigente_hasta is null or vigente_hasta>=(now() at time zone 'America/Santiago')::date) and exists(select 1 from hoteles h where h.id=hotel_id and h.estado='activo' and h.reservable));
drop policy if exists paquetes_gerencia on paquetes;
create policy paquetes_gerencia on paquetes for select to authenticated using(mi_rol()='gerente' and puede_operar(hotel_id));
drop policy if exists paquete_servicios_lectura on paquete_servicios;
create policy paquete_servicios_lectura on paquete_servicios for select to anon,authenticated using(exists(select 1 from paquetes p where p.id=paquete_id));
revoke insert,update,delete on paquetes,paquete_servicios from anon,authenticated;
create or replace function fn_guardar_paquete(p_datos jsonb,p_servicios jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid:=coalesce(nullif(p_datos->>'id','')::uuid,gen_random_uuid()); v_hotel uuid:=(p_datos->>'hotel_id')::uuid; anterior paquetes;
begin
 if mi_rol() is distinct from 'gerente' or not puede_operar(v_hotel) then raise exception 'Gestión de paquetes restringida a gerencia del hotel'; end if;
 select * into anterior from paquetes where id=v_id for update;
 if anterior.id is not null and anterior.hotel_id<>v_hotel then raise exception 'No se puede cambiar el hotel de un paquete'; end if;
 if length(trim(p_datos->>'nombre')) not between 2 and 150 or (p_datos->>'capacidad')::int<(p_datos->>'min_adultos')::int
 or (nullif(p_datos->>'vigente_desde','')::date>nullif(p_datos->>'vigente_hasta','')::date) then raise exception 'Revisa nombre, capacidad y vigencia'; end if;
 if not exists(select 1 from habitaciones where hotel_id=v_hotel and tipo=p_datos->>'tipo') then raise exception 'El hotel no tiene esa categoría'; end if;
 if coalesce(p_datos->>'imagen_url','')<>'' and not (p_datos->>'imagen_url' ~ '^https://' or p_datos->>'imagen_url' ~ '^/images/hoteles/[a-zA-Z0-9-]+\.(jpg|png|webp)$') then raise exception 'URL de portada inválida'; end if;
 insert into paquetes(id,hotel_id,nombre,descripcion,noches,tipo,activo,imagen_url,destacado,experiencia,capacidad,min_adultos,max_ninos,precio,precio_referencial,condiciones,no_incluye,vigente_desde,vigente_hasta)
 values(v_id,v_hotel,trim(p_datos->>'nombre'),p_datos->>'descripcion',(p_datos->>'noches')::int,p_datos->>'tipo',(p_datos->>'activo')::boolean,coalesce(p_datos->>'imagen_url',''),(p_datos->>'destacado')::boolean,p_datos->>'experiencia',(p_datos->>'capacidad')::int,(p_datos->>'min_adultos')::int,(p_datos->>'max_ninos')::int,(p_datos->>'precio')::numeric,nullif(p_datos->>'precio_referencial','')::numeric,coalesce(p_datos->>'condiciones',''),coalesce(p_datos->>'no_incluye',''),nullif(p_datos->>'vigente_desde','')::date,nullif(p_datos->>'vigente_hasta','')::date)
 on conflict(id) do update set nombre=excluded.nombre,descripcion=excluded.descripcion,noches=excluded.noches,tipo=excluded.tipo,activo=excluded.activo,imagen_url=excluded.imagen_url,destacado=excluded.destacado,experiencia=excluded.experiencia,capacidad=excluded.capacidad,min_adultos=excluded.min_adultos,max_ninos=excluded.max_ninos,precio=excluded.precio,precio_referencial=excluded.precio_referencial,condiciones=excluded.condiciones,no_incluye=excluded.no_incluye,vigente_desde=excluded.vigente_desde,vigente_hasta=excluded.vigente_hasta;
 -- Cambiar composición no altera servicios ya contratados ni snapshots.
 delete from paquete_servicios where paquete_id=v_id;
 if exists(select 1 from jsonb_to_recordset(p_servicios) as x(servicio_id uuid,cantidad int) left join servicios_adicionales s on s.id=x.servicio_id where s.id is null or s.hotel_id<>v_hotel or not s.activo or x.cantidad is null or x.cantidad<1) then raise exception 'Los servicios deben estar activos y pertenecer al hotel'; end if;
 insert into paquete_servicios(paquete_id,hotel_id,servicio_id,cantidad) select v_id,v_hotel,x.servicio_id,x.cantidad from jsonb_to_recordset(p_servicios) as x(servicio_id uuid,cantidad int);
 return v_id;
end $$;
revoke all on function fn_guardar_paquete(jsonb,jsonb) from public,anon;
grant execute on function fn_guardar_paquete(jsonb,jsonb) to authenticated;
-- Productos demo según servicios YA registrados; no se añaden masajes/traslados inexistentes.
insert into paquetes(hotel_id,nombre,descripcion,noches,tipo,experiencia,capacidad,min_adultos,max_ninos,precio,precio_referencial,destacado,condiciones,no_incluye)
 select h.id,e.nombre||' · '||h.nombre,e.descripcion,e.noches,e.tipo,e.nombre,2,e.adultos,e.ninos,
 round(r.tarifa*e.noches*0.9),r.tarifa*e.noches,true,'Producto demo para una habitación. Servicios enumerados incluidos; no se garantizan tratamientos fuera de esta lista.','Transporte, masajes, comidas y actividades no listadas.'
 from hoteles h cross join (values
 ('Escapada Spa',2,'doble',1,1,'Dos noches con acceso a instalaciones de spa registradas.'),
 ('Escapada Romántica',2,'suite',2,0,'Dos noches para dos adultos en suite, con acceso a instalaciones registradas.'),
 ('Aventura',3,'doble',1,1,'Tres noches con la actividad guiada registrada en el establecimiento.'),
 ('Relax',3,'doble',1,1,'Tres noches para descansar y disfrutar las instalaciones de bienestar registradas.')
 ) as e(nombre,noches,tipo,adultos,ninos,descripcion)
 cross join lateral(select min(precio_noche) as tarifa from habitaciones where hotel_id=h.id and tipo=e.tipo and estado='activa') r
 where h.inventario_demo and h.reservable and r.tarifa is not null
 and h.slug in ('noi-casa-atacama','noi-vitacura','antumalal','explora-atacama','explora-torres-del-paine')
 and exists(select 1 from servicios_adicionales s where s.hotel_id=h.id and s.activo and s.nombre=case when e.nombre='Aventura' then 'Excursiones guiadas' else 'Spa' end)
 on conflict(hotel_id,nombre) do nothing;
insert into paquete_servicios(paquete_id,hotel_id,servicio_id,cantidad)
 select p.id,p.hotel_id,s.id,1 from paquetes p join hoteles h on h.id=p.hotel_id join servicios_adicionales s on s.hotel_id=p.hotel_id and s.activo
 where h.inventario_demo and p.nombre in ('Escapada Spa · '||h.nombre,'Escapada Romántica · '||h.nombre,'Aventura · '||h.nombre,'Relax · '||h.nombre)
 and s.nombre=case when p.experiencia='Aventura' then 'Excursiones guiadas' else 'Spa' end
 and not exists(select 1 from migraciones_maremoto where version=13)
 on conflict do nothing;
insert into migraciones_maremoto(version) values(13) on conflict do nothing;
notify pgrst,'reload schema';
commit;
