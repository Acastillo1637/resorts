-- Ejecutar después de 01–07. Transaccional, idempotente y sin borrar datos.
begin;
do $$ begin
 if to_regclass('public.huespedes') is null or not exists(select 1 from public.migraciones_maremoto where version=7) then
   raise exception 'Falta ejecutar 07_gestion_hotelera.sql después de 01–06';
 end if;
end $$;
alter table hoteles add column if not exists slug text;
alter table hoteles add column if not exists zona text not null default 'Andes';
alter table hoteles add column if not exists destacado boolean not null default false;
alter table hoteles add column if not exists imagen_url text not null default '';
alter table hoteles add column if not exists fuente_url text not null default '';
alter table hoteles add column if not exists reservable boolean not null default true;
update hoteles set slug=case nombre when 'Residencia Cúncumen' then 'residencia-cuncumen' when 'Módulo Humo' then 'modulo-humo' when 'Casa Amatista' then 'casa-amatista' end
 where slug is null and nombre in ('Residencia Cúncumen','Módulo Humo','Casa Amatista');
create unique index if not exists hoteles_slug on hoteles(slug) where slug is not null;
-- Identidad: las reservas de clientes siguen vinculadas por cliente_id a perfiles/auth.users.
-- Un huésped de recepción solo es visible al cliente si figura en una reserva suya.
drop policy if exists huesped_propio on huespedes;
create policy huesped_propio on huespedes for select to authenticated using(
 exists(select 1 from reservas r where r.huesped_id=huespedes.id and r.cliente_id=auth.uid())
);

create table if not exists suscripciones (
 email text primary key check(email=lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(email)<=254),
 creado_en timestamptz not null default now()
);
alter table suscripciones enable row level security;
revoke all on suscripciones from anon,authenticated;
create or replace function fn_suscribir(p_email text) returns void
language plpgsql security definer set search_path=public as $$
begin
 insert into suscripciones(email) values(lower(trim(p_email))) on conflict(email) do nothing;
end $$;
revoke all on function fn_suscribir(text) from public;
grant execute on function fn_suscribir(text) to anon,authenticated;

create table if not exists paquetes (
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references hoteles(id),
 nombre text not null, descripcion text not null, noches int not null check(noches between 1 and 30),
 tipo text not null references tipos_habitacion(codigo), activo boolean not null default true,
 unique(hotel_id,nombre), unique(id,hotel_id)
);
create unique index if not exists servicios_id_hotel on servicios_adicionales(id,hotel_id);
create table if not exists paquete_servicios (
 paquete_id uuid not null, hotel_id uuid not null, servicio_id uuid not null,
 cantidad int not null check(cantidad>0), primary key(paquete_id,servicio_id),
 foreign key(paquete_id,hotel_id) references paquetes(id,hotel_id),
 foreign key(servicio_id,hotel_id) references servicios_adicionales(id,hotel_id)
);
alter table paquetes enable row level security;
alter table paquete_servicios enable row level security;
revoke all on paquetes,paquete_servicios from anon,authenticated;
alter table reservas add column if not exists paquete_id uuid references paquetes(id);

create or replace function fn_catalogo_publico() returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',h.id,'slug',coalesce(h.slug,h.id::text),'nombre',h.nombre,'direccion',h.direccion,
 'descripcion',h.descripcion,'zona',h.zona,'destacado',h.destacado,'imagen_url',h.imagen_url,
 'fuente_url',h.fuente_url,'reservable',h.reservable,
 'habitaciones',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'hotel_id',r.hotel_id,'numero',r.numero,'tipo',r.tipo,'capacidad',r.capacidad,'precio_noche',r.precio_noche,'estado',r.estado,'caracteristicas',r.caracteristicas) order by r.precio_noche),'[]'::jsonb) from habitaciones r where r.hotel_id=h.id),
 'servicios',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'hotel_id',s.hotel_id,'nombre',s.nombre,'descripcion',s.descripcion,'precio',s.precio,'activo',s.activo)),'[]'::jsonb) from servicios_adicionales s where s.hotel_id=h.id and s.activo)
 ) order by h.destacado desc,h.nombre),'[]'::jsonb) from hoteles h where h.estado='activo';
$$;
create or replace function fn_paquetes_publicos() returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'hotel_id',p.hotel_id,'nombre',p.nombre,'descripcion',p.descripcion,'noches',p.noches,'tipo',p.tipo,
 'precio',p.noches*(select min(precio_noche) from habitaciones where hotel_id=p.hotel_id and tipo=p.tipo)+coalesce((select sum(ps.cantidad*s.precio) from paquete_servicios ps join servicios_adicionales s on s.id=ps.servicio_id where ps.paquete_id=p.id),0),
 'servicios',(select coalesce(jsonb_agg(jsonb_build_object('servicio_id',s.id,'nombre',s.nombre,'cantidad',ps.cantidad)),'[]'::jsonb) from paquete_servicios ps join servicios_adicionales s on s.id=ps.servicio_id where ps.paquete_id=p.id)
 ) order by p.nombre),'[]'::jsonb) from paquetes p join hoteles h on h.id=p.hotel_id where p.activo and h.estado='activo'
 and not exists(select 1 from paquete_servicios ps join servicios_adicionales s on s.id=ps.servicio_id where ps.paquete_id=p.id and not s.activo);
$$;
revoke all on function fn_catalogo_publico(),fn_paquetes_publicos() from public;
grant execute on function fn_catalogo_publico(),fn_paquetes_publicos() to anon,authenticated;

-- Una transacción reserva alojamiento + servicios y factura. El cliente no fija precios.
create or replace function fn_reservar_paquete(p_paquete_id uuid,p_habitacion_id uuid,p_fecha_inicio date,p_adultos int default 1,p_ninos int default 0)
returns reservas language plpgsql security definer set search_path=public set timezone='America/Santiago' as $$
declare p paquetes; h habitaciones; r reservas; item record;
begin
 if auth.uid() is null or mi_rol() is distinct from 'cliente' then raise exception 'Inicia sesión como huésped'; end if;
 if p_adultos+p_ninos>2 then raise exception 'Este paquete admite hasta dos huéspedes'; end if;
 select * into p from paquetes where id=p_paquete_id and activo for share;
 select * into h from habitaciones where id=p_habitacion_id for update;
 if p.id is null or h.id is null or h.hotel_id<>p.hotel_id or h.tipo<>p.tipo or not exists(select 1 from hoteles where id=h.hotel_id and reservable) then raise exception 'Paquete no disponible para esta habitación'; end if;
 r:=fn_guardar_reserva(h.id,p_fecha_inicio,p_fecha_inicio+p.noches,p_adultos,p_ninos);
 for item in select ps.*,s.precio,s.activo from paquete_servicios ps join servicios_adicionales s on s.id=ps.servicio_id where ps.paquete_id=p.id for share of ps,s loop
   if not item.activo or item.hotel_id<>r.hotel_id then raise exception 'Servicio no disponible'; end if;
   insert into servicios_contratados(reserva_id,servicio_id,cantidad,precio_unitario) values(r.id,item.servicio_id,item.cantidad,item.precio);
 end loop;
 update reservas set paquete_id=p.id where id=r.id returning * into r;
 update facturas set monto_total=total_reserva(r.id) where reserva_id=r.id;
 return r;
end $$;
revoke all on function fn_reservar_paquete(uuid,uuid,date,int,int) from public,anon;
grant execute on function fn_reservar_paquete(uuid,uuid,date,int,int) to authenticated;
-- Proteger también las RPC existentes: inventario no verificado no se puede reservar.
create or replace function validar_hotel_reservable() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if TG_OP='INSERT' and not exists(select 1 from hoteles where id=new.hotel_id and reservable) then raise exception 'Inventario pendiente de validación para este hotel'; end if;
 if TG_OP='UPDATE' and old.paquete_id is not null and (new.habitacion_id<>old.habitacion_id or new.fecha_inicio<>old.fecha_inicio or new.fecha_fin<>old.fecha_fin) then raise exception 'La modificación de un paquete requiere atención del hotel'; end if;
 return new;
end $$;
revoke all on function validar_hotel_reservable() from public,anon,authenticated;
drop trigger if exists validar_hotel_reservable on reservas;
create trigger validar_hotel_reservable before insert or update on reservas for each row execute function validar_hotel_reservable();
insert into migraciones_maremoto(version) values(10) on conflict do nothing;
notify pgrst, 'reload schema';
commit;
