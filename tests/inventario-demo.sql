-- Solo para la base efímera de scripts/test-db.mjs; revierte las reservas de prueba.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert(ok boolean, mensaje text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FALLÓ: %',mensaje; end if; end $$;
create function pg_temp.rechaza(sql text, mensaje text) returns void language plpgsql as $$ begin begin execute sql; exception when others then return; end; raise exception 'FALLÓ (no rechazó): %',mensaje; end $$;
select pg_temp.assert((select count(*)=13 from hoteles where inventario_demo and reservable and estado='activo'),'13 hoteles demo habilitados');
select pg_temp.assert((select count(*)=39 from habitaciones r join hoteles h on h.id=r.hotel_id where h.inventario_demo and r.numero in ('DEMO-D01','DEMO-S01','DEMO-F01')),'39 habitaciones sin duplicados');
select pg_temp.assert(not exists(select 1 from hoteles where inventario_demo and (imagen_url='' or not imagen_ambiente)),'portadas en Supabase');
select pg_temp.assert(not exists(select 1 from habitaciones r join hoteles h on h.id=r.hotel_id where h.inventario_demo and r.numero='CAT-DOBLE' and r.estado<>'inactiva'),'categorías antiguas conservadas inactivas');
insert into auth.users(id,raw_user_meta_data) values('b0000000-0000-0000-0000-000000000001','{"rut":"66666666-6","nombre":"Cliente inventario demo"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
do $$ declare h record; room uuid; pack uuid; r reservas; total numeric; begin
 for h in select * from hoteles where inventario_demo loop
   select id into room from fn_disponibilidad(h.id,current_date+90,current_date+92,'doble') where numero='DEMO-D01';
   perform pg_temp.assert(room is not null,'doble disponible: '||h.nombre);
   select id into pack from jsonb_to_recordset(fn_paquetes_publicos()) as p(id uuid,hotel_id uuid) where p.hotel_id=h.id limit 1;
   perform pg_temp.assert(pack is not null,'paquete publicado: '||h.nombre);
   r:=fn_reservar_paquete(pack,room,current_date+90,2,0);
   perform pg_temp.assert(r.hotel_id=h.id and r.cliente_id=auth.uid() and r.fecha_fin-r.fecha_inicio=2,'reserva vinculada: '||h.nombre);
   select (r.fecha_fin-r.fecha_inicio)*r.tarifa_noche+coalesce(sum(c.cantidad*c.precio_unitario),0) into total from servicios_contratados c where c.reserva_id=r.id;
   perform pg_temp.assert((select monto_total=total from facturas where reserva_id=r.id),'factura paquete: '||h.nombre);
   perform pg_temp.assert(not exists(select 1 from fn_disponibilidad(h.id,current_date+90,current_date+92,'doble') where id=room),'habitación ocupada deja de aparecer');
   perform pg_temp.rechaza(format('select fn_guardar_reserva(%L,current_date+91,current_date+93,2,0)',room),'solapamiento estancia-paquete');
   perform pg_temp.rechaza(format('select fn_reservar_paquete(%L,%L,current_date+90,2,0)',pack,room),'solapamiento paquete-paquete');
   perform pg_temp.assert(exists(select 1 from fn_disponibilidad(h.id,current_date+92,current_date+94,'doble') where id=room),'intervalo adyacente disponible');
   select id into room from fn_disponibilidad(h.id,current_date+90,current_date+92,'familiar') where numero='DEMO-F01';
   perform pg_temp.assert(room is not null,'familiar disponible: '||h.nombre);
   perform fn_guardar_reserva(room,current_date+90,current_date+92,2,2);
   perform pg_temp.rechaza(format('select fn_guardar_reserva(%L,current_date+94,current_date+96,3,2)',room),'rechaza sobrecapacidad');
 end loop;
end $$;
reset role;
rollback;
\echo Inventario demo: disponibilidad, paquetes, precios, capacidad y protección de solapamiento comprobados.
