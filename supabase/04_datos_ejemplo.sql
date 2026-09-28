-- =====================================================================
-- DATOS DE EJEMPLO para la exposición (opcional pero recomendado)
-- Ejecutar DESPUÉS de 01, 02 y 03
-- =====================================================================

insert into regiones (nombre) values
  ('Región Metropolitana'),
  ('Valparaíso'),
  ('Los Lagos');

insert into hoteles (nombre, region_id, direccion)
select 'Resort Santiago Centro', id, 'Av. Libertador 1200' from regiones where nombre = 'Región Metropolitana';

insert into hoteles (nombre, region_id, direccion)
select 'Resort Las Condes', id, 'Av. Apoquindo 5500' from regiones where nombre = 'Región Metropolitana';

insert into hoteles (nombre, region_id, direccion)
select 'Resort Viña del Mar', id, 'Av. Perú 300' from regiones where nombre = 'Valparaíso';

insert into hoteles (nombre, region_id, direccion)
select 'Resort Puerto Varas', id, 'Costanera 800' from regiones where nombre = 'Los Lagos';

-- Habitaciones para cada hotel
do $$
declare
  h record;
  n int;
begin
  for h in select id from hoteles loop
    for n in 1..6 loop
      insert into habitaciones (hotel_id, numero, tipo, capacidad, precio_noche)
      values (
        h.id,
        'H' || (100 + n),
        (array['individual','doble','suite','familiar'])[1 + (n % 4)],
        (array[1,2,4,5])[1 + (n % 4)],
        (array[35000,55000,120000,90000])[1 + (n % 4)]
      );
    end loop;
  end loop;
end $$;

-- Servicios adicionales de ejemplo por hotel
insert into servicios_adicionales (hotel_id, nombre, descripcion, precio)
select id, 'Spa & Relax', 'Acceso a spa por 2 horas', 25000 from hoteles;

insert into servicios_adicionales (hotel_id, nombre, descripcion, precio)
select id, 'Tour guiado local', 'Excursión de medio día', 40000 from hoteles;

insert into servicios_adicionales (hotel_id, nombre, descripcion, precio)
select id, 'Servicio a la habitación', 'Carta 24/7', 8000 from hoteles;

-- =====================================================================
-- Cuentas de PERSONAL (gerente / recepcionista) de ejemplo:
-- estas NO se crean por SQL porque primero deben existir en
-- Supabase Auth. Instrucciones exactas en el README, sección
-- "Crear el primer gerente y recepcionista".
-- =====================================================================
