-- Ejecutar solo después de 15 y de crear/asignar las cuentas documentadas.
-- No crea usuarios Auth. Todas las comprobaciones se revierten al finalizar.
begin;
create function pg_temp.assert(ok boolean, mensaje text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALLÓ: %',mensaje; end if; end $$;
create function pg_temp.prohibido(sql text) returns void language plpgsql as $$
begin
 begin execute sql;
 exception when insufficient_privilege then return;
 end;
 raise exception 'Se permitió modificar un campo protegido';
end $$;
create function pg_temp.rpc_denegada(sql text, mensaje text) returns void language plpgsql as $$
begin
 begin execute sql;
 exception when raise_exception then
  if sqlerrm=mensaje then return; end if;
  raise;
 end;
 raise exception 'La RPC permitió una operación ajena';
end $$;
select set_config('test.santiago',(select id::text from public.hoteles where nombre='Resort Santiago Centro'),true);
select set_config('test.atacama',(select id::text from public.hoteles where nombre='Tierra Atacama'),true);
select set_config('test.patagonia',(select id::text from public.hoteles where nombre='Explora Torres del Paine'),true);
select pg_temp.assert(nullif(current_setting('test.santiago'),'') is not null and nullif(current_setting('test.atacama'),'') is not null and nullif(current_setting('test.patagonia'),'') is not null,'Existen los tres hoteles');
select set_config('test.central',(select id::text from auth.users where email='gerencia@almondresorts.cl'),true);
select set_config('test.gerente',(select id::text from auth.users where email='gerencia.santiago@almondresorts.cl'),true);
select set_config('test.recepcion',(select id::text from auth.users where email='recepcion.santiago@almondresorts.cl'),true);
select set_config('test.cliente',(select id::text from public.perfiles where rol='cliente' order by creado_en limit 1),true);
select pg_temp.assert(nullif(current_setting('test.central'),'') is not null and nullif(current_setting('test.gerente'),'') is not null and nullif(current_setting('test.recepcion'),'') is not null and nullif(current_setting('test.cliente'),'') is not null,'Cuentas asignadas y al menos un cliente existente');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.recepcion'),true);
select pg_temp.assert(public.mi_rol()='recepcionista' and public.puede_operar(current_setting('test.santiago')::uuid) and not public.puede_operar(current_setting('test.atacama')::uuid) and not public.puede_operar(current_setting('test.patagonia')::uuid),'Recepción limitada a Santiago');
select pg_temp.assert(not exists(select 1 from public.hoteles where id<>current_setting('test.santiago')::uuid) and not exists(select 1 from public.reservas where hotel_id<>current_setting('test.santiago')::uuid) and not exists(select 1 from public.huespedes where hotel_id<>current_setting('test.santiago')::uuid),'RLS recepción aísla hoteles, reservas y huéspedes');
select pg_temp.prohibido('update public.perfiles set rol=''gerente_general'' where id=auth.uid()');
select pg_temp.prohibido('update public.perfiles set hotel_id=null where id=auth.uid()');
select pg_temp.rpc_denegada(format('select public.fn_disponibilidad(%L,current_date+300,current_date+302)',current_setting('test.atacama')),'No autorizado para este hotel');
select pg_temp.rpc_denegada(format('select public.fn_guardar_paquete(%L::jsonb,''[]''::jsonb)',jsonb_build_object('hotel_id',current_setting('test.patagonia'))::text),'Gestión de paquetes restringida a gerencia del hotel');
select set_config('request.jwt.claim.sub',current_setting('test.gerente'),true);
select pg_temp.assert(public.mi_rol()='gerente' and public.puede_operar(current_setting('test.santiago')::uuid) and not public.puede_operar(current_setting('test.atacama')::uuid) and not public.puede_operar(current_setting('test.patagonia')::uuid),'Gerente limitado a Santiago');
select pg_temp.assert(not exists(select 1 from public.habitaciones where hotel_id<>current_setting('test.santiago')::uuid) and not exists(select 1 from public.paquetes where hotel_id<>current_setting('test.santiago')::uuid) and not exists(select 1 from public.reservas where hotel_id<>current_setting('test.santiago')::uuid),'RLS gerente aísla habitaciones, paquetes y reservas');
select pg_temp.rpc_denegada(format('select public.fn_disponibilidad(%L,current_date+300,current_date+302)',current_setting('test.patagonia')),'No autorizado para este hotel');
select pg_temp.rpc_denegada(format('select public.fn_guardar_paquete(%L::jsonb,''[]''::jsonb)',jsonb_build_object('hotel_id',current_setting('test.atacama'))::text),'Gestión de paquetes restringida a gerencia del hotel');
with changed as (update public.hoteles set nombre=nombre where id=current_setting('test.atacama')::uuid returning id)
select pg_temp.assert(count(*)=0,'Gerente no modifica hotel ajeno') from changed;
select set_config('request.jwt.claim.sub',current_setting('test.central'),true);
select pg_temp.assert(public.mi_rol()='gerente_general' and public.mi_hotel() is null and public.puede_operar(current_setting('test.santiago')::uuid) and public.puede_operar(current_setting('test.atacama')::uuid) and public.puede_operar(current_setting('test.patagonia')::uuid),'Gerencia General opera los tres hoteles');
select pg_temp.assert((select count(*)=3 from public.hoteles where id in (current_setting('test.santiago')::uuid,current_setting('test.atacama')::uuid,current_setting('test.patagonia')::uuid)),'Gerencia General lee los tres hoteles');
with changed as (update public.hoteles set nombre=nombre where id=current_setting('test.atacama')::uuid returning id)
select pg_temp.assert(count(*)=1,'Gerencia General administra Atacama') from changed;
select pg_temp.prohibido('update public.perfiles set rol=''gerente'' where id=auth.uid()');
select set_config('request.jwt.claim.sub',current_setting('test.cliente'),true);
select pg_temp.assert(not public.puede_operar(current_setting('test.santiago')::uuid) and not exists(select 1 from public.reservas where cliente_id is distinct from auth.uid()),'Cliente sin administración ni reservas ajenas');
select pg_temp.prohibido('update public.perfiles set rol=''gerente_general'' where id=auth.uid()');
select pg_temp.prohibido('update public.perfiles set hotel_id=null where id=auth.uid()');
select pg_temp.rpc_denegada(format('select public.fn_guardar_paquete(%L::jsonb,''[]''::jsonb)',jsonb_build_object('hotel_id',current_setting('test.santiago'))::text),'Gestión de paquetes restringida a gerencia del hotel');
reset role;
set local role anon;
select pg_temp.prohibido('select * from public.perfiles');
select pg_temp.prohibido('select * from public.reservas');
select pg_temp.prohibido('select public.puede_operar(null)');
reset role;
rollback;
