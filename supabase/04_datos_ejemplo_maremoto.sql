-- Datos demo alineados con el diseño visual Maremoto.
-- Úsalo EN LUGAR de 04_datos_ejemplo.sql si quieres que frontend y base compartan identidad.
insert into regiones (nombre) values ('Coquimbo'),('Los Lagos'),('Valparaíso') on conflict do nothing;
insert into hoteles (nombre,region_id,direccion)
select 'Residencia Cúncumen',id,'Valle del Elqui' from regiones where nombre='Coquimbo' and not exists(select 1 from hoteles where nombre='Residencia Cúncumen');
insert into hoteles (nombre,region_id,direccion)
select 'Módulo Humo',id,'Archipiélago de Chiloé' from regiones where nombre='Los Lagos' and not exists(select 1 from hoteles where nombre='Módulo Humo');
insert into hoteles (nombre,region_id,direccion)
select 'Casa Amatista',id,'Zapallar' from regiones where nombre='Valparaíso' and not exists(select 1 from hoteles where nombre='Casa Amatista');
insert into habitaciones(hotel_id,numero,tipo,capacidad,precio_noche)
select id,'C01','doble',2,210000 from hoteles where nombre='Residencia Cúncumen' on conflict do nothing;
insert into habitaciones(hotel_id,numero,tipo,capacidad,precio_noche)
select id,'C02','suite',3,285000 from hoteles where nombre='Residencia Cúncumen' on conflict do nothing;
insert into habitaciones(hotel_id,numero,tipo,capacidad,precio_noche)
select id,'H01','familiar',3,165000 from hoteles where nombre='Módulo Humo' on conflict do nothing;
insert into habitaciones(hotel_id,numero,tipo,capacidad,precio_noche)
select id,'A01','doble',2,320000 from hoteles where nombre='Casa Amatista' on conflict do nothing;
insert into habitaciones(hotel_id,numero,tipo,capacidad,precio_noche)
select id,'A02','familiar',8,890000 from hoteles where nombre='Casa Amatista' on conflict do nothing;
insert into servicios_adicionales(hotel_id,nombre,descripcion,precio)
select id,'Desayuno Maremoto','Desayuno para huéspedes',18000 from hoteles h where not exists(select 1 from servicios_adicionales s where s.hotel_id=h.id and s.nombre='Desayuno Maremoto');
