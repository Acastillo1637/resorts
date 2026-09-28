-- Opcional: únicamente entorno de demostración. No crea cuentas ni contraseñas.
-- Idempotente por IDs estables. Las fechas se fijan en la primera ejecución.
begin;
do $$
declare h uuid; g uuid := 'd0000000-0000-0000-0000-000000000001'; room uuid := 'd0000000-0000-0000-0000-000000000002'; r uuid; i int; inicio date; fin date; estado text;
begin
 select id into h from hoteles where nombre='Residencia Cúncumen' order by creado_en limit 1;
 if h is null then raise exception 'Ejecuta primero 04_datos_ejemplo_maremoto.sql'; end if;
 insert into huespedes(id,hotel_id,nombre,documento,email,telefono,notas) values(g,h,'Camila Ríos (demostración)','DEMO-PAS-001','camila@example.test','+56 9 5555 0101','Datos ficticios; prefiere habitación tranquila.') on conflict(id) do nothing;
 insert into habitaciones(id,hotel_id,numero,tipo,capacidad,precio_noche,caracteristicas) values(room,h,'DEMO-301','suite',3,185000,'Terraza y vista al valle') on conflict(id) do nothing;
 for i in 1..5 loop
   r:=('d0000000-0000-0000-0000-'||lpad((100+i)::text,12,'0'))::uuid;
   inicio:=current_date+case i when 1 then -10 when 2 then -1 when 3 then 5 when 4 then 12 else 20 end;
   fin:=inicio+3;
   estado:=case i when 1 then 'check_out' when 2 then 'check_in' when 3 then 'confirmada' when 4 then 'pendiente' else 'cancelada' end;
   insert into reservas(id,huesped_id,habitacion_id,hotel_id,fecha_inicio,fecha_fin,estado,adultos,ninos,tarifa_noche,notas,entrada_en,salida_en)
   values(r,g,room,h,inicio,fin,estado,2,1,185000,'Reserva ficticia de demostración',case when i<=2 then inicio::timestamptz end,case when i=1 then fin::timestamptz end) on conflict(id) do nothing;
   insert into facturas(reserva_id,monto_total,estado,referencia_sistema_legado) select r,555000,case when i<=2 then 'pagada' when i=5 then 'anulada' else 'pendiente' end,'DEMO-'||i where not exists(select 1 from facturas where reserva_id=r);
   if i<=3 then
     insert into pagos(reserva_id,monto,tipo,metodo,referencia,idempotencia) values(r,case when i<=2 then 555000 else 100000 end,'pago','transferencia','Comprobante ficticio',('d0000000-0000-0000-0000-'||lpad((200+i)::text,12,'0'))::uuid) on conflict(idempotencia) do nothing;
   end if;
 end loop;
end $$;
commit;
