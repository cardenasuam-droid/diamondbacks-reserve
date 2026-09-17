-- 0055_registration_prefill.sql
-- Precarga de la inscripción para quien YA tiene cuenta: un RPC que devuelve
-- los datos de TU PROPIA ficha (la enlazada a tu sesión) para rellenar el
-- formulario de otra liga sin teclear todo de nuevo.
--
-- SECURITY DEFINER a propósito y con cuidado: el teléfono NO es público
-- (CLAUDE.md §5), pero aquí solo se devuelve el del propio solicitante — la
-- fila se ancla a auth.uid() → profiles.player_id y no acepta parámetros, así
-- que no hay forma de pedir datos de otra persona. anon queda sin EXECUTE.
-- La unificación real de cuentas entre ligas (persons) llega en F3; esto es
-- la mejora de UX que no depende de ella.

create or replace function my_player_prefill()
returns table (
  full_name     text,
  phone         text,
  gender        gender_type,
  category_code text,
  "position"    player_position,
  shirt_size    text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.full_name, p.phone, p.gender, p.category_code, p.position, p.shirt_size
    from players p
    join profiles pr on pr.player_id = p.id
   where pr.id = auth.uid()
   limit 1;
$$;

revoke all on function my_player_prefill() from public, anon;
grant execute on function my_player_prefill() to authenticated;
