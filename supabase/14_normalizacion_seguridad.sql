-- Ejecutar después de 13. Conserva IDs, reservas e importes históricos.
begin;
do $$ begin if not exists(select 1 from public.migraciones_maremoto where version=13) then raise exception 'Ejecuta primero 13_paquetes_productos.sql'; end if; end $$;
alter table public.paquetes add column if not exists min_huespedes int not null default 1;
do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.paquetes'::regclass and conname='paquete_ocupacion_minima') then
 alter table public.paquetes add constraint paquete_ocupacion_minima check(min_huespedes between 1 and capacidad);
end if; end $$;
-- Texto contractual explícito determina ocupación exacta; "hasta" conserva el mínimo.
update public.paquetes set min_huespedes=capacidad where descripcion ~* 'para (dos|2) (adultos|personas|huéspedes)' and descripcion !~* 'hasta' and min_huespedes<>capacidad;
update public.paquetes set min_adultos=1,max_ninos=1,min_huespedes=2,
 descripcion='Dos noches para dos personas en suite, con los servicios incluidos en la ficha.'
 where experiencia='Escapada Romántica' and capacidad=2 and min_adultos=2 and max_ninos=0
 and condiciones like 'Producto demo%';

-- Numeración por categoría, sin colisiones ni cambios de identidad.
do $$ declare r record; n int; codigo text; begin
 for r in select id,hotel_id,tipo from public.habitaciones where numero ~* '^(DEMO[-_]|CAT[-_])' order by hotel_id,numero loop
   n:=case r.tipo when 'suite' then 301 when 'familiar' then 201 else 101 end;
   loop codigo:=n::text; exit when not exists(select 1 from public.habitaciones where hotel_id=r.hotel_id and numero=codigo); n:=n+1; end loop;
   update public.habitaciones set numero=codigo where id=r.id;
 end loop;
end $$;
create or replace function public.almond_texto_profesional(v text) returns text language sql immutable set search_path=pg_catalog,public,pg_temp as $$
 select trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(v,'\m(datos|inventario)( de)? (prueba|demostración)\M','', 'gi'),'\s*\((demo|demostración)\)','', 'gi'),'\m(demo|demostración|ficticios?|ficticias?)\M','', 'gi'),'\s+',' ','g'));
$$;
update public.habitaciones set caracteristicas=public.almond_texto_profesional(caracteristicas) where caracteristicas ~* 'demo|demostración|fictici';
update public.paquetes p set descripcion=format('Escapada de %s noches en %s con alojamiento y los servicios incluidos en este paquete.',p.noches,h.nombre)
 from public.hoteles h where h.id=p.hotel_id and p.descripcion ~* 'demo|demostración|datos de prueba';
update public.paquetes set condiciones='Reserva para una habitación. Incluye los servicios enumerados en la ficha del paquete.' where condiciones ~* 'demo|demostración';
-- Normalizar textos descriptivos conocidos, nunca importes ni documentos de identidad reales.
do $$ declare item record; begin
 for item in select * from (values ('hoteles','nombre'),('hoteles','descripcion'),('paquetes','nombre'),('servicios_adicionales','nombre'),('servicios_adicionales','descripcion'),('tipos_habitacion','nombre'),('tipos_habitacion','descripcion'),('huespedes','nombre'),('huespedes','notas'),('reservas','notas'),('pagos','referencia'),('servicios_contratados','nombre_contratado')) as x(tabla,columna) loop
  execute format('update public.%I set %I=public.almond_texto_profesional(%I) where %I ~* %L',item.tabla,item.columna,item.columna,item.columna,'\m(demo|demostración|ficticios?|ficticias?|datos de prueba|inventario de prueba)\M');
 end loop;
end $$;
-- Identificador sintético de la semilla 08, conservando al huésped y sus relaciones.
do $$ declare h uuid; n int:=1; codigo text; begin
 select hotel_id into h from public.huespedes where id='d0000000-0000-0000-0000-000000000001' and documento='DEMO-PAS-001';
 if h is not null then
  loop codigo:='PAS-'||case when n<1000 then lpad(n::text,3,'0') else n::text end; exit when not exists(select 1 from public.huespedes where hotel_id=h and documento=codigo); n:=n+1; end loop;
  update public.huespedes set documento=codigo where id='d0000000-0000-0000-0000-000000000001';
 end if;
end $$;
update public.huespedes set notas='Prefiere una habitación tranquila.' where id='d0000000-0000-0000-0000-000000000001' and notas='Datos ; prefiere habitación tranquila.';
update public.facturas set referencia_sistema_legado=regexp_replace(referencia_sistema_legado,'^DEMO-','AR-') where referencia_sistema_legado ~ '^DEMO-';
-- Solo los campos de presentación del contrato. El bloqueo DDL excluye escrituras concurrentes.
alter table public.reservas disable trigger validar_hotel_reservable;
update public.reservas set paquete_snapshot=jsonb_set(paquete_snapshot,'{nombre}',to_jsonb(public.almond_texto_profesional(paquete_snapshot->>'nombre')))
 where paquete_snapshot->>'nombre' ~* '\m(demo|demostración)\M';
update public.reservas set paquete_snapshot=jsonb_set(paquete_snapshot,'{descripcion}',to_jsonb('Alojamiento y servicios incluidos según el contrato de esta reserva.'::text))
 where paquete_snapshot->>'descripcion' ~* 'demo|demostración';
update public.reservas set paquete_snapshot=jsonb_set(paquete_snapshot,'{condiciones}',to_jsonb('Servicios enumerados incluidos en el contrato de esta reserva.'::text))
 where paquete_snapshot->>'condiciones' ~* 'demo|demostración';
alter table public.reservas enable trigger validar_hotel_reservable;
drop function public.almond_texto_profesional(text);

create or replace function public.paquete_valido(p_id uuid,p_inicio date,p_adultos int,p_ninos int) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select coalesce(p.activo and h.estado='activo' and h.reservable and p_inicio>=(now() at time zone 'America/Santiago')::date
 and p_adultos>=greatest(1,p.min_adultos) and p_ninos>=0 and p_ninos<=p.max_ninos
 and p_adultos::bigint+p_ninos between p.min_huespedes and p.capacidad
 and (p.vigente_desde is null or p_inicio>=p.vigente_desde)
 and (p.vigente_hasta is null or p_inicio+p.noches-1<=p.vigente_hasta)
 and not exists(select 1 from public.paquete_servicios ps join public.servicios_adicionales s on s.id=ps.servicio_id where ps.paquete_id=p.id and (not s.activo or s.hotel_id<>p.hotel_id)),false)
 from public.paquetes p join public.hoteles h on h.id=p.hotel_id where p.id=p_id;
$$;

-- Privilegios explícitos: lectura personal bajo RLS, escrituras financieras solo por RPC.
revoke create on schema public from public,anon,authenticated;
revoke all on public.regiones,public.hoteles,public.habitaciones,public.perfiles,public.reservas,public.huespedes,public.servicios_adicionales,public.servicios_contratados,public.facturas,public.pagos,public.eventos_reserva,public.auditoria,public.tipos_habitacion,public.paquetes,public.paquete_servicios,public.suscripciones,public.migraciones_maremoto from public,anon,authenticated;
grant select on public.regiones,public.hoteles,public.habitaciones,public.perfiles,public.reservas,public.huespedes,public.servicios_adicionales,public.servicios_contratados,public.facturas,public.pagos,public.eventos_reserva,public.auditoria,public.tipos_habitacion,public.paquetes,public.paquete_servicios to authenticated;
grant insert,update on public.hoteles,public.habitaciones,public.huespedes,public.servicios_adicionales,public.tipos_habitacion to authenticated;
-- REVOKE ALL de tabla no elimina privilegios de columnas antiguos.
revoke update(id,rut,nombre,rol,hotel_id,telefono,creado_en) on public.perfiles from public,anon,authenticated;
grant update(nombre,telefono) on public.perfiles to authenticated;
drop policy if exists cliente_se_autoregistra on public.perfiles;
drop policy if exists cliente_crea_su_reserva on public.reservas;
drop policy if exists cliente_cancela_su_reserva on public.reservas;
drop policy if exists personal_actualiza_reservas_su_hotel on public.reservas;
drop policy if exists personal_ve_reservas_su_hotel on public.reservas;
create policy personal_ve_reservas_su_hotel on public.reservas for select to authenticated using(public.puede_operar(hotel_id));
drop policy if exists acceso_servicios_contratados on public.servicios_contratados;
create policy acceso_servicios_contratados on public.servicios_contratados for select to authenticated using(exists(select 1 from public.reservas r where r.id=reserva_id and (r.cliente_id=auth.uid() or public.puede_operar(r.hotel_id))));
drop policy if exists acceso_facturas on public.facturas;
create policy acceso_facturas on public.facturas for select to authenticated using(exists(select 1 from public.reservas r where r.id=reserva_id and (r.cliente_id=auth.uid() or public.puede_operar(r.hotel_id))));
-- El personal ve el catálogo operativo de sus hoteles; el catálogo público es una RPC.
drop policy if exists catalogo_lectura_hoteles on public.hoteles;
create policy catalogo_lectura_hoteles on public.hoteles for select to authenticated using(public.puede_operar(id) or (public.mi_rol()='cliente' and estado='activo') or exists(select 1 from public.reservas r where r.hotel_id=hoteles.id and r.cliente_id=auth.uid()));
drop policy if exists catalogo_lectura_habitaciones on public.habitaciones;
create policy catalogo_lectura_habitaciones on public.habitaciones for select to authenticated using(public.puede_operar(hotel_id) or (public.mi_rol()='cliente' and estado='activa') or exists(select 1 from public.reservas r where r.habitacion_id=habitaciones.id and r.cliente_id=auth.uid()));
drop policy if exists catalogo_lectura_servicios on public.servicios_adicionales;
create policy catalogo_lectura_servicios on public.servicios_adicionales for select to authenticated using(public.puede_operar(hotel_id) or (public.mi_rol()='cliente' and activo) or exists(select 1 from public.servicios_contratados c join public.reservas r on r.id=c.reserva_id where c.servicio_id=servicios_adicionales.id and r.cliente_id=auth.uid()));
-- Evita recursión servicios_contratados -> reservas -> catálogo (reservas no consulta catálogo en sus policies).
-- La lectura administrativa de paquetes queda limitada al hotel autorizado.
drop policy if exists paquetes_publicos on public.paquetes;
create policy paquetes_publicos on public.paquetes for select to authenticated using(public.mi_rol()='cliente' and activo and exists(select 1 from public.hoteles h where h.id=hotel_id and h.estado='activo' and h.reservable));
drop policy if exists paquete_servicios_lectura on public.paquete_servicios;
create policy paquete_servicios_lectura on public.paquete_servicios for select to authenticated using(exists(select 1 from public.paquetes p where p.id=paquete_id));

-- Todas las tablas de la aplicación mantienen RLS; ninguna lectura pública directa.
do $$ declare t text; begin
 foreach t in array array['regiones','hoteles','habitaciones','perfiles','reservas','huespedes','servicios_adicionales','servicios_contratados','facturas','pagos','eventos_reserva','auditoria','tipos_habitacion','paquetes','paquete_servicios','suscripciones','migraciones_maremoto'] loop
  execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;

create or replace function fn_guardar_paquete(p_datos jsonb,p_servicios jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid:=coalesce(nullif(p_datos->>'id','')::uuid,gen_random_uuid()); v_hotel uuid:=(p_datos->>'hotel_id')::uuid; anterior paquetes;
begin
 if jsonb_typeof(p_datos) is distinct from 'object' or jsonb_typeof(p_servicios) is distinct from 'array' then raise exception 'Datos de paquete inválidos'; end if;
 if mi_rol() is distinct from 'gerente' or not puede_operar(v_hotel) then raise exception 'Gestión de paquetes restringida a gerencia del hotel'; end if;
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

-- No conceder automáticamente acceso a toda función fn_* (incluye triggers privados).
do $$ declare f record; publicas text[]:=array['fn_catalogo_publico','fn_paquetes_publicos','fn_disponibilidad_paquete','fn_suscribir'];
 autorizadas text[]:=array['mi_rol','mi_hotel','puede_operar','validar_rut','fn_guardar_reserva','fn_crear_reserva','fn_estado_reserva','fn_checkin','fn_checkout','fn_cancelar_reserva','fn_registrar_pago','fn_contratar_servicio','fn_disponibilidad','fn_sugerir_alternativas','fn_reservar_paquete','fn_guardar_paquete'];
begin
 for f in select p.oid::regprocedure as firma,p.proname,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname like 'fn\_%' escape '\' or p.proname=any(autorizadas) or p.proname in ('paquete_valido','total_reserva','saldo_pagado','versionar_paquete','validar_hotel_reservable','validar_cambio_habitacion')) loop
  execute format('alter function %s set search_path=pg_catalog,public,pg_temp',f.firma);
  execute format('revoke all on function %s from public,anon,authenticated',f.firma);
  if f.proname=any(publicas) then execute format('grant execute on function %s to anon,authenticated',f.firma);
  elsif f.proname=any(autorizadas) then execute format('grant execute on function %s to authenticated',f.firma);
  end if;
 end loop;
end $$;
insert into public.migraciones_maremoto(version) values(14) on conflict do nothing;
notify pgrst,'reload schema';
commit;
