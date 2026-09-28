-- =====================================================================
-- SEGURIDAD: ROW LEVEL SECURITY (RLS)
-- Control de acceso por rol (Gerente / Recepción / Cliente) - RNF-04
-- Principio: denegar por defecto, permitir solo lo mínimo necesario
-- (OWASP A01 - Broken Access Control / ISO 27001 A.9 Control de acceso)
-- =====================================================================

alter table regiones             enable row level security;
alter table hoteles              enable row level security;
alter table habitaciones         enable row level security;
alter table perfiles             enable row level security;
alter table reservas             enable row level security;
alter table servicios_adicionales enable row level security;
alter table servicios_contratados enable row level security;
alter table facturas             enable row level security;
alter table eventos_reserva      enable row level security;
alter table auditoria            enable row level security;

-- Función auxiliar: rol y hotel del usuario autenticado actual
create or replace function mi_rol() returns text
language sql stable security definer as $$
  select rol from perfiles where id = auth.uid();
$$;

create or replace function mi_hotel() returns uuid
language sql stable security definer as $$
  select hotel_id from perfiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- CATALOGO PUBLICO (regiones, hoteles, habitaciones, servicios):
-- lectura para cualquier usuario autenticado (necesario para que el
-- cliente busque disponibilidad); escritura solo gerente.
-- ---------------------------------------------------------------------
create policy "catalogo_lectura_regiones" on regiones
  for select using (auth.role() = 'authenticated');

create policy "catalogo_lectura_hoteles" on hoteles
  for select using (auth.role() = 'authenticated');

create policy "catalogo_lectura_habitaciones" on habitaciones
  for select using (auth.role() = 'authenticated');

create policy "gerente_escribe_habitaciones" on habitaciones
  for all using (
    mi_rol() = 'gerente' and (mi_hotel() is null or mi_hotel() = hotel_id)
  ) with check (
    mi_rol() = 'gerente' and (mi_hotel() is null or mi_hotel() = hotel_id)
  );

create policy "catalogo_lectura_servicios" on servicios_adicionales
  for select using (auth.role() = 'authenticated');

create policy "gerente_recepcion_gestiona_servicios" on servicios_adicionales
  for all using (
    (mi_rol() = 'gerente' and (mi_hotel() is null or mi_hotel() = hotel_id))
    or (mi_rol() = 'recepcionista' and mi_hotel() = hotel_id)
  ) with check (
    (mi_rol() = 'gerente' and (mi_hotel() is null or mi_hotel() = hotel_id))
    or (mi_rol() = 'recepcionista' and mi_hotel() = hotel_id)
  );

-- ---------------------------------------------------------------------
-- PERFILES: cada usuario ve y edita solo su propia fila.
-- El personal (gerente/recepcion) puede ver perfiles de clientes
-- (necesario para operar check-in), pero no de otros empleados.
-- ---------------------------------------------------------------------
create policy "ver_mi_perfil" on perfiles
  for select using (id = auth.uid());

create policy "personal_ve_clientes" on perfiles
  for select using (mi_rol() in ('gerente','recepcionista') and rol = 'cliente');

create policy "actualizar_mi_perfil" on perfiles
  for update using (id = auth.uid()) with check (id = auth.uid() and rol = (select rol from perfiles where id = auth.uid()));

-- Nota de seguridad importante (evita escalación de privilegios,
-- OWASP A01): el alta de perfiles con rol 'gerente' o 'recepcionista'
-- NO se hace desde el formulario público de registro. Se hace desde
-- el panel de Supabase (Authentication > Add user) + un INSERT manual
-- en esta tabla hecho por quien administra el proyecto. Ver README.
create policy "cliente_se_autoregistra" on perfiles
  for insert with check (id = auth.uid() and rol = 'cliente');

-- ---------------------------------------------------------------------
-- RESERVAS
-- ---------------------------------------------------------------------
create policy "cliente_ve_sus_reservas" on reservas
  for select using (cliente_id = auth.uid());

create policy "cliente_crea_su_reserva" on reservas
  for insert with check (cliente_id = auth.uid());

create policy "cliente_cancela_su_reserva" on reservas
  for update using (cliente_id = auth.uid() and estado = 'confirmada')
  with check (estado = 'cancelada');

create policy "personal_ve_reservas_su_hotel" on reservas
  for select using (
    mi_rol() in ('gerente','recepcionista') and (mi_hotel() is null or mi_hotel() = hotel_id)
  );

create policy "personal_actualiza_reservas_su_hotel" on reservas
  for update using (
    mi_rol() in ('gerente','recepcionista') and (mi_hotel() is null or mi_hotel() = hotel_id)
  );

-- ---------------------------------------------------------------------
-- SERVICIOS CONTRATADOS Y FACTURAS: visibles solo para el dueño de la
-- reserva o para el personal del hotel correspondiente.
-- ---------------------------------------------------------------------
create policy "acceso_servicios_contratados" on servicios_contratados
  for all using (
    exists (
      select 1 from reservas r
      where r.id = servicios_contratados.reserva_id
        and (r.cliente_id = auth.uid()
             or (mi_rol() in ('gerente','recepcionista') and (mi_hotel() is null or mi_hotel() = r.hotel_id)))
    )
  );

create policy "acceso_facturas" on facturas
  for select using (
    exists (
      select 1 from reservas r
      where r.id = facturas.reserva_id
        and (r.cliente_id = auth.uid()
             or (mi_rol() in ('gerente','recepcionista') and (mi_hotel() is null or mi_hotel() = r.hotel_id)))
    )
  );

-- ---------------------------------------------------------------------
-- EVENTOS Y AUDITORIA: solo personal interno (nunca clientes).
-- ---------------------------------------------------------------------
create policy "personal_ve_eventos" on eventos_reserva
  for select using (mi_rol() in ('gerente','recepcionista'));

create policy "gerente_ve_auditoria" on auditoria
  for select using (mi_rol() = 'gerente');

-- =====================================================================
-- FIN 02_seguridad_rls.sql
-- =====================================================================
