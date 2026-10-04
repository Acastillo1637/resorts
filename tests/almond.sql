-- Solo para la base efímera de scripts/test-db.mjs. Todos los cambios se revierten.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert(ok boolean, mensaje text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FALLÓ: %',mensaje; end if; end $$;
create function pg_temp.rechaza(sql text, mensaje text) returns void language plpgsql as $$ begin begin execute sql; exception when others then return; end; raise exception 'FALLÓ (no rechazó): %',mensaje; end $$;
select pg_temp.assert((select count(*)=13 from hoteles where fuente_url<>''),'13 hoteles reales, semilla idempotente');
select pg_temp.assert(not exists(select 1 from paquete_servicios ps join servicios_adicionales s on s.id=ps.servicio_id where ps.hotel_id<>s.hotel_id),'servicios del mismo hotel');
select set_config('test.hotel',(select id::text from hoteles where nombre='Residencia Cúncumen'),true);
select set_config('test.room',(select id::text from habitaciones where numero='C01'),true);
select set_config('test.package',(select id::text from paquetes where hotel_id=current_setting('test.hotel')::uuid limit 1),true);
insert into servicios_adicionales(id,hotel_id,nombre,precio) values('a0000000-0000-0000-0000-000000000001',current_setting('test.hotel')::uuid,'Servicio prueba de precio',5000);
insert into paquete_servicios(paquete_id,hotel_id,servicio_id,cantidad) values(current_setting('test.package')::uuid,current_setting('test.hotel')::uuid,'a0000000-0000-0000-0000-000000000001',2);
select pg_temp.rechaza(format('insert into paquete_servicios(paquete_id,hotel_id,servicio_id,cantidad) values(%L,%L,%L,1)',current_setting('test.package'),(select hotel_id from servicios_adicionales where hotel_id<>current_setting('test.hotel')::uuid limit 1),(select id from servicios_adicionales where hotel_id<>current_setting('test.hotel')::uuid limit 1)),'FK rechaza servicio ajeno');
insert into auth.users(id,raw_user_meta_data) values('a0000000-0000-0000-0000-000000000002','{"rut":"55555555-5","nombre":"Cliente Almond"}');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.assert(jsonb_array_length(fn_catalogo_publico())>=13,'catálogo público anónimo');
select pg_temp.assert(jsonb_array_length(fn_paquetes_publicos())>=13,'paquetes públicos anónimos');
select fn_suscribir('  ALMOND@example.test  ');
select fn_suscribir('almond@example.test');
select pg_temp.rechaza('select * from suscripciones','no exponer correos');
select pg_temp.rechaza('select fn_suscribir(''invalido'')','validación servidor de correo');
select pg_temp.rechaza(format('select fn_reservar_paquete(%L,%L,current_date+60)',current_setting('test.package'),current_setting('test.room')),'anónimo no reserva');
reset role;
select pg_temp.assert((select count(*)=1 from suscripciones where email='almond@example.test'),'suscripción idempotente y normalizada');
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select set_config('test.reserva',(fn_reservar_paquete(current_setting('test.package')::uuid,current_setting('test.room')::uuid,current_date+60,2,0)).id::text,true);
select pg_temp.assert((select fecha_fin-fecha_inicio=2 and cliente_id=auth.uid() and paquete_id=current_setting('test.package')::uuid from reservas where id=current_setting('test.reserva')::uuid),'duración e identidad de paquete');
select pg_temp.assert((select monto_total=430000 from facturas where reserva_id=current_setting('test.reserva')::uuid),'factura incluye servicios con precio del servidor');
select pg_temp.rechaza(format('select fn_reservar_paquete(%L,%L,current_date+60)',current_setting('test.package'),current_setting('test.room')),'no sobreventa de paquete');
reset role;
update servicios_adicionales set activo=false where id='a0000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.rechaza(format('select fn_reservar_paquete(%L,%L,current_date+70)',current_setting('test.package'),current_setting('test.room')),'servicio desactivado rechaza paquete');
select pg_temp.assert(not exists(select 1 from reservas where fecha_inicio=current_date+70),'rollback atómico sin reserva parcial');
reset role;
rollback;
\echo Pruebas Almond completadas; datos de prueba revertidos.
