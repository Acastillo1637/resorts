-- Catálogo real; precios CLP orientativos, NO tarifas oficiales ni cupos contratados.
-- No inventa habitaciones físicas: CAT-DOBLE es una categoría inactiva hasta su validación.
-- Fuentes oficiales consultadas 2026-10-03, enlazadas en cada ficha.
begin;
create temporary table almond_semilla(slug text,nombre text,region text,direccion text,zona text,descripcion text,precio numeric,servicios text[],fuente text) on commit drop;
insert into almond_semilla values
('noi-casa-atacama','NOI Casa Atacama','Antofagasta','San Pedro de Atacama, Antofagasta','Desierto','Hotel de 45 habitaciones en San Pedro, con restaurante Casa Paniri y spa Lican Sumaq.',230000,array['Restaurante','Spa','Piscina exterior'],'https://www.noihotels.com/es/hotels'),
('noi-vitacura','NOI Vitacura','Metropolitana','Vitacura, Santiago','Andes','Hotel urbano junto al barrio gastronómico de Alonso de Córdova, con terraza Tramonto y NOI Spa.',190000,array['Desayuno buffet','Spa','Terraza'],'https://www.noihotels.com/es/hotels'),
('noi-puma-lodge','NOI Puma Lodge','O’Higgins','Cordillera de O’Higgins','Andes','Refugio cordillerano con 24 habitaciones y dos apartamentos, restaurante y Los Cipreses Spa.',280000,array['Piscina exterior','Spa','Gimnasio','Restaurante'],'https://www.noihotels.com/es/hotels'),
('noi-blend-colchagua','NOI Blend Colchagua','O’Higgins','Valle de Colchagua, O’Higgins','Andes','Hotel de 25 habitaciones en una casona histórica de 1875, entre paisajes rurales del valle.',160000,array[]::text[],'https://www.noihotels.com/es/hotels'),
('noi-indigo-patagonia','NOI Indigo Patagonia','Magallanes','Puerto Natales, Magallanes','Patagonia','Hotel de diseño en Puerto Natales, con 61 habitaciones, restaurante Kosten y spa Aiken.',200000,array['Restaurante','Spa'],'https://www.noihotels.com/es/hotels'),
('tierra-atacama','Tierra Atacama','Antofagasta','San Pedro de Atacama, Antofagasta','Desierto','Lodge con vistas andinas. Uma Spa dispone de piscina interior climatizada y piscina exterior.',850000,array['Spa','Piscina climatizada','Piscina exterior'],'https://reservas.tierrahotels.com/es/lodge/'),
('tierra-patagonia','Tierra Patagonia','Magallanes','Lago Sarmiento, Torres del Paine','Patagonia','Hotel frente al paisaje de Torres del Paine, con habitaciones superiores que permiten configuraciones conectadas.',950000,array[]::text[],'https://tierrapatagonia.com/es/stay/'),
('explora-atacama','Explora Atacama','Antofagasta','San Pedro de Atacama, Antofagasta','Desierto','Lodge de 50 habitaciones con observatorio, caballerizas y espacios de descanso. Ofrece programas de exploración.',780000,array['Sauna','Piscinas','Excursiones guiadas'],'https://www.explora.com/lodge/atacama-lodge/'),
('explora-torres-del-paine','Explora Torres del Paine','Magallanes','Lago Pehoé, Torres del Paine','Patagonia','Lodge de 50 habitaciones junto al lago Pehoé, con spa panorámico y programas de exploración del parque.',900000,array['Spa','Piscina climatizada','Sauna','Excursiones guiadas'],'https://www.explora.com/lodge/torres-del-paine-lodge'),
('explora-rapa-nui','Explora Rapa Nui','Valparaíso','Rapa Nui, Isla de Pascua','Litoral','Lodge con 26 habitaciones Varúa y cuatro suites, vistas al océano o jardín y spa Hare Vaka.',800000,array['Spa','Piscina exterior','Sauna'],'https://www.explora.com/es/hotel-en-isla-de-pascua'),
('hotel-portillo','Hotel Portillo','Valparaíso','Laguna del Inca, Los Andes','Andes','Hotel de montaña del centro de esquí Portillo, con piscina exterior y actividades après ski sujetas a temporada.',480000,array['Piscina exterior','Jacuzzi','Gimnasio'],'https://skiportillo.com/centro-de-ayuda/'),
('antumalal','Antumalal','La Araucanía','Pucón, Lago Villarrica','Andes','Hotel de arquitectura modernista con habitaciones y chalets frente al lago, restaurante Parque Antumalal y Spa Antumaco.',350000,array['Spa','Piscina interior','Piscina exterior','Restaurante'],'https://antumalal.com/'),
('hotel-costa-real','Hotel Costa Real','Coquimbo','Francisco de Aguirre 170, La Serena','Litoral','Hotel cercano al centro histórico de La Serena, con gastronomía local y piscina.',115000,array['Restaurante','Piscina exterior'],'https://costareal.cl/');
insert into regiones(nombre) select distinct region from almond_semilla on conflict(nombre) do nothing;
-- Reutilizar hoteles existentes con el mismo nombre, sin cambiar sus datos comerciales.
update hoteles h set slug=s.slug,fuente_url=s.fuente,zona=s.zona from almond_semilla s where lower(h.nombre)=lower(s.nombre) and h.slug is null;
insert into hoteles(nombre,region_id,direccion,descripcion,servicios,slug,zona,destacado,fuente_url,reservable)
 select s.nombre,r.id,s.direccion,s.descripcion,s.servicios,s.slug,s.zona,s.slug in ('noi-casa-atacama','antumalal','hotel-costa-real'),s.fuente,false
 from almond_semilla s join regiones r on r.nombre=s.region
 where not exists(select 1 from hoteles h where h.slug=s.slug or lower(h.nombre)=lower(s.nombre));
insert into habitaciones(hotel_id,numero,tipo,capacidad,precio_noche,estado,caracteristicas)
 select h.id,'CAT-DOBLE','doble',2,s.precio,'inactiva','Alojamiento doble · categoría por validar'
 from almond_semilla s join hoteles h on h.slug=s.slug
 where not h.reservable and not exists(select 1 from habitaciones r where r.hotel_id=h.id)
 on conflict(hotel_id,numero) do nothing;
-- Reutiliza la relación hotel-servicios de 01, no crea un catálogo paralelo.
insert into servicios_adicionales(hotel_id,nombre,descripcion,precio)
 select h.id,amenity.nombre,'Instalación del hotel; acceso y condiciones sujetos a validación de la tarifa.',0
 from hoteles h cross join lateral unnest(h.servicios) as amenity(nombre)
 where not exists(select 1 from servicios_adicionales s where s.hotel_id=h.id and s.nombre=amenity.nombre);
insert into paquetes(hotel_id,nombre,descripcion,noches,tipo)
 select h.id,'Escapada · '||h.nombre,'Dos noches para dos huéspedes. Incluye únicamente los servicios listados. Tarifa referencial hasta validar inventario.',2,'doble'
 from hoteles h join almond_semilla s on h.slug=s.slug
on conflict(hotel_id,nombre) do nothing;
-- Los hoteles ya operativos también ofrecen una estadía conectada a su inventario real.
insert into paquetes(hotel_id,nombre,descripcion,noches,tipo)
 select h.id,'Escapada · '||h.nombre,'Dos noches de alojamiento para hasta dos huéspedes. Consulta disponibilidad y precio de la habitación antes de confirmar.',2,'doble'
 from hoteles h where h.reservable and h.estado='activo' and exists(select 1 from habitaciones r where r.hotel_id=h.id and r.tipo='doble' and r.estado='activa')
 on conflict(hotel_id,nombre) do nothing;
-- Solo piscina/sauna: no incluye tratamientos, comidas o excursiones sin precio validado.
insert into paquete_servicios(paquete_id,hotel_id,servicio_id,cantidad)
 select p.id,p.hotel_id,s.id,1 from paquetes p join hoteles h on h.id=p.hotel_id
 join almond_semilla seed on seed.slug=h.slug
 join servicios_adicionales s on s.hotel_id=p.hotel_id and s.nombre in ('Piscina exterior','Piscina climatizada','Piscina interior','Sauna') and s.activo
 where p.nombre='Escapada · '||h.nombre
 on conflict do nothing;
insert into migraciones_maremoto(version) values(11) on conflict do nothing;
notify pgrst, 'reload schema';
commit;
