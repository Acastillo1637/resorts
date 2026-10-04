\set ON_ERROR_STOP on
begin;
create function pg_temp.assert(ok boolean,mensaje text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FALLÓ: %',mensaje; end if; end $$;
create function pg_temp.rechaza(sql text,mensaje text) returns void language plpgsql as $$ begin begin execute sql; exception when others then return; end; raise exception 'FALLÓ (no rechazó): %',mensaje; end $$;
select pg_temp.assert(not exists(select 1 from habitaciones where numero ~* '^(DEMO|CAT)[-_]'),'numeración profesional');
select pg_temp.assert(not exists(select 1 from paquetes where descripcion ~* 'demo|demostración' or condiciones ~* 'demo|demostración'),'textos profesionales');
select pg_temp.assert(not has_table_privilege('anon','public.reservas','SELECT'),'anon no accede a reservas');
select pg_temp.assert(not has_table_privilege('authenticated','public.reservas','UPDATE'),'sin manipulación directa de tarifas');
select pg_temp.assert(not has_column_privilege('authenticated','public.perfiles','rol','UPDATE'),'sin escalación de rol');
select pg_temp.assert(not has_table_privilege('authenticated','public.perfiles','INSERT'),'sin alta manual de perfiles');
select pg_temp.assert(not has_function_privilege('authenticated','public.total_reserva(uuid)','EXECUTE'),'total privado');
select pg_temp.assert(not has_function_privilege('authenticated','public.fn_auditar()','EXECUTE'),'trigger privado');
select pg_temp.assert(not has_function_privilege('anon','public.mi_rol()','EXECUTE'),'identidad privada');
select pg_temp.assert((select bool_and(relrowsecurity) from pg_class where oid in ('public.reservas'::regclass,'public.paquetes'::regclass,'public.huespedes'::regclass,'public.pagos'::regclass,'public.suscripciones'::regclass,'public.servicios_contratados'::regclass)),'RLS datos sensibles');
select set_config('test.pkg',(select id::text from paquetes where nombre='Escapada Romántica · NOI Casa Atacama'),true);
select set_config('test.room',(select r.id::text from habitaciones r join paquetes p on p.hotel_id=r.hotel_id and p.tipo=r.tipo where p.id=current_setting('test.pkg')::uuid and r.estado='activa' order by r.numero limit 1),true);
select set_config('test.hotel',(select hotel_id::text from paquetes where id=current_setting('test.pkg')::uuid),true);
insert into auth.users(id,raw_user_meta_data) values
 ('e0000000-0000-0000-0000-000000000001','{"rut":"11111111-1","nombre":"Cliente titular"}'),
 ('e0000000-0000-0000-0000-000000000002','{"rut":"22222222-2","nombre":"Otro cliente"}'),
 ('e0000000-0000-0000-0000-000000000003','{"rut":"33333333-3","nombre":"Recepción otro hotel"}');
update perfiles set rol='recepcionista',hotel_id=(select id from hoteles where id<>current_setting('test.hotel')::uuid order by nombre limit 1) where id='e0000000-0000-0000-0000-000000000003';
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.assert(exists(select 1 from fn_disponibilidad_paquete(current_setting('test.pkg')::uuid,current_date+240,1,1)),'composición pública válida');
select pg_temp.rechaza(format('select fn_disponibilidad_paquete(%L,current_date+240,1,0)',current_setting('test.pkg')),'exactamente dos');
select pg_temp.rechaza(format('select fn_disponibilidad_paquete(%L,current_date+240,0,2)',current_setting('test.pkg')),'adulto obligatorio');
select pg_temp.rechaza('select * from suscripciones','suscripciones privadas');
select pg_temp.rechaza('select * from perfiles','anon sin perfiles');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e0000000-0000-0000-0000-000000000001',true);
select set_config('test.reserva',(fn_reservar_paquete(current_setting('test.pkg')::uuid,current_setting('test.room')::uuid,current_date+240,1,1)).id::text,true);
select pg_temp.assert((select adultos=1 and ninos=1 and paquete_precio_contratado>0 from reservas where id=current_setting('test.reserva')::uuid),'contrato y precio del servidor');
select pg_temp.rechaza(format('select fn_reservar_paquete(%L,%L,current_date+240,1,1)',current_setting('test.pkg'),current_setting('test.room')),'reserva duplicada bloqueada');
select pg_temp.rechaza(format('select fn_reservar_paquete(%L,%L,current_date+250,1,0)',current_setting('test.pkg'),current_setting('test.room')),'backend rechaza ocupación incompleta');
select pg_temp.rechaza('update perfiles set rol=''gerente'' where id=auth.uid()','rol protegido');
select pg_temp.rechaza('update reservas set paquete_precio_contratado=1','total protegido');
select set_config('request.jwt.claim.sub','e0000000-0000-0000-0000-000000000002',true);
select pg_temp.assert(not exists(select 1 from reservas),'cliente no lee reservas ajenas');
select pg_temp.assert(not exists(select 1 from pagos),'cliente no lee pagos ajenos');
select pg_temp.assert(not exists(select 1 from servicios_contratados),'cliente no lee servicios ajenos');
select pg_temp.rechaza(format('select fn_cancelar_reserva(%L)',current_setting('test.reserva')),'cliente no cancela reserva ajena');
select set_config('request.jwt.claim.sub','e0000000-0000-0000-0000-000000000003',true);
select pg_temp.assert(not exists(select 1 from reservas where hotel_id=current_setting('test.hotel')::uuid),'personal aislado por hotel');
select pg_temp.assert(not exists(select 1 from hoteles where id=current_setting('test.hotel')::uuid),'catálogo operativo aislado');
select pg_temp.rechaza(format('select fn_checkin(%L)',current_setting('test.reserva')),'operación ajena denegada');
reset role;
rollback;
