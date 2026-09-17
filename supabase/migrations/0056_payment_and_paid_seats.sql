-- 0056_payment_and_paid_seats.sql
-- Circuito de pago de la inscripción femenil (decisiones del organizador,
-- 2026-09-17):
--   (a) segundo comprobante OPCIONAL: quien jugó el torneo de Peak Padel sube
--       también su comprobante de inscripción a ese torneo y obtiene $250 de
--       descuento (lo valida el comité, como el pago);
--   (b) el CUPO se cuenta por pagos verificados, no por aprobaciones
--       ("tu lugar se aparta cuando confirmamos tu pago", mecanismo del
--       torneo de Peak): un RPC público devuelve SOLO el número, sin exponer
--       la bandeja (que sigue siendo privada por los teléfonos).
-- El candado duro de fichas (players, 0050) se queda como cinturón.

alter table player_registrations
  add column if not exists discount_receipt_path text;

alter table player_registrations drop constraint if exists registrations_discount_path_shape;
alter table player_registrations add constraint registrations_discount_path_shape
  check (discount_receipt_path is null or discount_receipt_path ~ '^registrations/[A-Za-z0-9._-]+$');

-- Cupo pagado de una edición: inscripciones con pago verificado que no
-- fueron rechazadas. SECURITY DEFINER porque la bandeja no es legible por
-- anon; aquí solo sale un entero.
create or replace function season_paid_count(p_season_id uuid)
returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int
    from player_registrations r
   where r.season_id = p_season_id
     and r.payment_verified_at is not null
     and r.status <> 'rejected';
$$;

grant execute on function season_paid_count(uuid) to anon, authenticated;
