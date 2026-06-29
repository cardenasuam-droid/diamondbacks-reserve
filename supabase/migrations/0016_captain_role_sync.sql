-- 0016_captain_role_sync.sql
-- Sincroniza profiles.role con players.is_captain. Antes, el rol se fijaba SOLO al
-- crear la cuenta (handle_new_user); marcar a alguien como capitana DESPUÉS de que
-- ya tenía cuenta no le daba acceso al panel de capitanas. Esto lo corrige.

-- Trigger: al cambiar is_captain, ajusta el rol del perfil enlazado. Solo alterna
-- entre 'player' y 'captain' — nunca toca 'organizer'/'web_manager'.
create or replace function sync_captain_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_captain and not coalesce(old.is_captain, false) then
    update profiles set role = 'captain' where player_id = new.id and role = 'player';
  elsif coalesce(old.is_captain, false) and not new.is_captain then
    update profiles set role = 'player' where player_id = new.id and role = 'captain';
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_captain_role on players;
create trigger trg_sync_captain_role
  after update of is_captain on players
  for each row execute function sync_captain_role();

-- Sincronización ÚNICA para las capitanas ya marcadas que ya tienen cuenta.
-- (Tras correr esto, esas capitanas deben cerrar sesión y volver a entrar.)
update profiles p
set role = 'captain'
from players pl
where p.player_id = pl.id and pl.is_captain = true and p.role = 'player';
