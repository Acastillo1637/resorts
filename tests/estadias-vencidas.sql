-- Después de 16, SQL Editor. Solo cálculos, sin usuarios ni escrituras persistentes.
begin;
do $$ declare r public.reservas; estado text; hoy date:=(now() at time zone 'America/Santiago')::date;
begin
 foreach estado in array array['pendiente','confirmada','check_in'] loop
  r.estado:=estado; r.fecha_inicio:=hoy-20; r.fecha_fin:=hoy-1;
  if public.estado_vigente(r)<>'vencida' then raise exception 'No identificó vencida %',estado; end if;
  if r.estado<>estado or r.salida_en is not null then raise exception 'Alteró cierre operativo'; end if;
  r.fecha_fin:=hoy;
  if public.estado_vigente(r)<>estado then raise exception 'Finalizó prematuramente'; end if;
  r.fecha_fin:=hoy+1;
  if public.estado_vigente(r)<>estado then raise exception 'Se usó inicio en lugar de fin'; end if;
 end loop;
 r.estado:='cancelada'; r.fecha_fin:=hoy-1;
 if public.estado_vigente(r)<>'cancelada' then raise exception 'Alteró cancelada'; end if;
 r.estado:='check_out';
 if public.estado_vigente(r)<>'check_out' then raise exception 'Alteró finalizada'; end if;
end $$;
rollback;
