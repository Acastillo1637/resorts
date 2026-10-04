-- Requiere 07, 10 y 11. Inventario explícitamente DEMO, sin cupos comerciales.
-- Idempotente: conserva habitaciones, precios y reservas existentes.
begin;
do $$ begin
 if not exists(select 1 from migraciones_maremoto where version=11) then
   raise exception 'Ejecuta primero 11_hoteles_chile.sql';
 end if;
end $$;
alter table hoteles add column if not exists inventario_demo boolean not null default false;
alter table hoteles add column if not exists imagen_ambiente boolean not null default false;
create temporary table almond_demo(slug text primary key,tarifa numeric,imagen text) on commit drop;
insert into almond_demo values
 ('noi-casa-atacama',230000,'/images/hoteles/desierto.jpg'),
 ('noi-vitacura',190000,'/images/hoteles/andes.jpg'),
 ('noi-puma-lodge',280000,'/images/hoteles/andes.jpg'),
 ('noi-blend-colchagua',160000,'/images/hoteles/andes.jpg'),
 ('noi-indigo-patagonia',200000,'/images/hoteles/patagonia.jpg'),
 ('tierra-atacama',850000,'/images/hoteles/desierto.jpg'),
 ('tierra-patagonia',950000,'/images/hoteles/patagonia.jpg'),
 ('explora-atacama',780000,'/images/hoteles/desierto.jpg'),
 ('explora-torres-del-paine',900000,'/images/hoteles/patagonia.jpg'),
 ('explora-rapa-nui',800000,'/images/hoteles/litoral.jpg'),
 ('hotel-portillo',480000,'/images/hoteles/andes.jpg'),
 ('antumalal',350000,'/images/hoteles/patagonia.jpg'),
 ('hotel-costa-real',115000,'/images/hoteles/litoral.jpg');
insert into tipos_habitacion(codigo,nombre,descripcion) values
 ('doble','Doble','Alojamiento para dos huéspedes'),
 ('suite','Suite','Alojamiento de mayor amplitud'),
 ('familiar','Familiar','Alojamiento para familias') on conflict(codigo) do nothing;
-- Tres unidades demo por hotel. CAT-DOBLE se conserva sin activarla ni modificarla.
insert into habitaciones(hotel_id,numero,tipo,capacidad,precio_noche,estado,caracteristicas)
 select h.id,r.numero,r.tipo,r.capacidad,round(d.tarifa*r.factor), 'activa',r.descripcion
 from almond_demo d join hoteles h on h.slug=d.slug
 cross join (values
   ('DEMO-D01','doble',2,1.00::numeric,'Doble demo · cama matrimonial o dos camas'),
   ('DEMO-S01','suite',2,1.35::numeric,'Suite demo · cama king y zona de estar'),
   ('DEMO-F01','familiar',4,1.65::numeric,'Familiar demo · cama matrimonial y dos camas individuales')
 ) as r(numero,tipo,capacidad,factor,descripcion)
 on conflict(hotel_id,numero) do nothing;
-- La primera aplicación habilita únicamente los establecimientos de esta semilla.
-- Reejecutar no reactiva hoteles que la administración haya deshabilitado después.
update hoteles h set reservable=true,estado='activo',inventario_demo=true
 from almond_demo d where h.slug=d.slug
 and not exists(select 1 from migraciones_maremoto where version=12);
update hoteles h set imagen_url=d.imagen,imagen_ambiente=true
 from almond_demo d where h.slug=d.slug and coalesce(h.imagen_url,'')='';
update paquetes p set descripcion='Estadía demo de dos noches para hasta dos huéspedes, con los servicios listados. Reserva registrada en Almond Resorts con inventario de demostración.'
 from hoteles h join almond_demo d on d.slug=h.slug
 where p.hotel_id=h.id and p.nombre='Escapada · '||h.nombre
 and p.descripcion='Dos noches para dos huéspedes. Incluye únicamente los servicios listados. Tarifa referencial hasta validar inventario.';
-- Misma fuente pública para todas las pantallas; no expone huéspedes ni reservas.
create or replace function fn_catalogo_publico() returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',h.id,'slug',coalesce(h.slug,h.id::text),'nombre',h.nombre,'direccion',h.direccion,
 'descripcion',h.descripcion,'zona',h.zona,'destacado',h.destacado,'imagen_url',h.imagen_url,
 'imagen_ambiente',h.imagen_ambiente,'inventario_demo',h.inventario_demo,
 'fuente_url',h.fuente_url,'reservable',h.reservable,
 'habitaciones',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'hotel_id',r.hotel_id,'numero',r.numero,'tipo',r.tipo,'capacidad',r.capacidad,'precio_noche',r.precio_noche,'estado',r.estado,'caracteristicas',r.caracteristicas) order by r.precio_noche),'[]'::jsonb) from habitaciones r where r.hotel_id=h.id and r.estado='activa'),
 'servicios',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'hotel_id',s.hotel_id,'nombre',s.nombre,'descripcion',s.descripcion,'precio',s.precio,'activo',s.activo)),'[]'::jsonb) from servicios_adicionales s where s.hotel_id=h.id and s.activo)
 ) order by h.destacado desc,h.nombre),'[]'::jsonb) from hoteles h where h.estado='activo';
$$;
-- La tarifa del paquete corresponde a habitaciones activas, nunca a CAT-DOBLE.
create or replace function fn_paquetes_publicos() returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'hotel_id',p.hotel_id,'nombre',p.nombre,'descripcion',p.descripcion,'noches',p.noches,'tipo',p.tipo,
 'precio',p.noches*(select min(precio_noche) from habitaciones where hotel_id=p.hotel_id and tipo=p.tipo and estado='activa')+coalesce((select sum(ps.cantidad*s.precio) from paquete_servicios ps join servicios_adicionales s on s.id=ps.servicio_id where ps.paquete_id=p.id),0),
 'servicios',(select coalesce(jsonb_agg(jsonb_build_object('servicio_id',s.id,'nombre',s.nombre,'cantidad',ps.cantidad)),'[]'::jsonb) from paquete_servicios ps join servicios_adicionales s on s.id=ps.servicio_id where ps.paquete_id=p.id)
 ) order by p.nombre),'[]'::jsonb) from paquetes p join hoteles h on h.id=p.hotel_id where p.activo and h.estado='activo' and h.reservable
 and exists(select 1 from habitaciones r where r.hotel_id=p.hotel_id and r.tipo=p.tipo and r.estado='activa')
 and not exists(select 1 from paquete_servicios ps join servicios_adicionales s on s.id=ps.servicio_id where ps.paquete_id=p.id and not s.activo);
$$;
revoke all on function fn_catalogo_publico(),fn_paquetes_publicos() from public;
grant execute on function fn_catalogo_publico(),fn_paquetes_publicos() to anon,authenticated;
insert into migraciones_maremoto(version) values(12) on conflict do nothing;
notify pgrst,'reload schema';
commit;
