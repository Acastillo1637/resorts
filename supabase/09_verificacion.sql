-- Solo lectura. Ejecutar después de 07 sobre el entorno de destino.
select * from migraciones_maremoto order by version;
select r.id as reserva_inconsistente from reservas r join habitaciones h on h.id=r.habitacion_id where r.hotel_id<>h.hotel_id;
select id as habitacion_capacidad_invalida from habitaciones where capacidad<=0;
select reserva_id,count(*) as cantidad_facturas from facturas group by reserva_id having count(*)>1;
select r.id as pago_historico_sin_movimiento from reservas r where exists(select 1 from facturas f where f.reserva_id=r.id and f.estado='pagada') and not exists(select 1 from pagos p where p.reserva_id=r.id);
select conrelid::regclass as tabla,conname,convalidated from pg_constraint where connamespace='public'::regnamespace and not convalidated;
-- Solo tras resolver las inconsistencias, validar las restricciones heredadas:
-- alter table reservas validate constraint reserva_hotel_habitacion;
-- alter table habitaciones validate constraint capacidad_positiva;
-- alter table hoteles validate constraint hotel_nombre_valido;
-- alter table habitaciones validate constraint numero_valido;
-- alter table servicios_adicionales validate constraint servicio_nombre_valido;
-- alter table perfiles validate constraint perfil_nombre_valido;
