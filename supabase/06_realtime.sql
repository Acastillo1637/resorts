-- =====================================================================
-- Habilita Realtime sobre "reservas" para que panel-recepcion.html
-- reciba actualizaciones en vivo (patrón Observer) cada vez que se
-- crea, cancela o cambia de estado una reserva de su hotel.
--
-- Si te sale un error de tipo "relation already member of publication"
-- es porque ya estaba habilitado -- no es un problema, ignóralo.
-- =====================================================================

alter publication supabase_realtime add table reservas;
