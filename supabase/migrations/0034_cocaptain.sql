-- 0034_cocaptain.sql
-- Rol CO-CAPITÁN: un segundo referente por equipo con EXACTAMENTE los mismos
-- accesos que el capitán.
--
-- Decisión de diseño (2026-07-16): NO se agrega un valor al enum user_role. El
-- co-capitán lleva profiles.role='captain' (accesos idénticos, sin tocar guards
-- ni políticas por rol) y se distingue con la bandera players.is_cocaptain, que
-- da la etiqueta "Co-capitán". Igual que el capitán, casi todos sus permisos
-- fluyen por captain_team_id(); basta con que esa función también lo cuente, y
-- con propagar la bandera a las 3 piezas que miran is_captain directo
-- (handle_new_user, sync_captain_role, players_public).

-- ---------------------------------------------------------------------------
-- Bandera + reglas de integridad (espejo de is_captain / one_captain_per_team).
-- ---------------------------------------------------------------------------
alter table players add column if not exists is_cocaptain boolean not null default false;

-- Máximo un co-capitán por equipo (espeja one_captain_per_team de 0001).
create unique index if not exists one_cocaptain_per_team
  on players (team_id) where (is_cocaptain = true);

-- No se puede ser capitán Y co-capitán del mismo equipo a la vez.
alter table players drop constraint if exists players_not_captain_and_cocaptain;
alter table players add constraint players_not_captain_and_cocaptain
  check (not (is_captain and is_cocaptain));

-- Un co-capitán siempre está en un equipo (no tiene sentido en el pool).
alter table players drop constraint if exists players_cocaptain_has_team;
alter table players add constraint players_cocaptain_has_team
  check (not is_cocaptain or team_id is not null);

-- ---------------------------------------------------------------------------
-- captain_team_id(): el choke point. Ahora cuenta capitán O co-capitán, así el
-- co-capitán hereda de golpe la RLS de lineups/players/contactos, el RPC
-- save_lineup y el make_pick del draft. (Redefine 0005 sumando is_cocaptain.)
-- ---------------------------------------------------------------------------
create or replace function captain_team_id()
returns uuid language sql stable security definer set search_path = public as $$
  select me.team_id
  from profiles pr
  join players me on me.id = pr.player_id
  where pr.id = auth.uid() and (me.is_captain or me.is_cocaptain)
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Rol al crear cuenta: el co-capitán también entra como 'captain'. (Redefine el
-- handle_new_user vivo de 0008, cambiando solo la condición del rol.)
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pid   uuid;
  v_last4 text;
  pl      players%rowtype;
  v_role  user_role := 'player';
begin
  v_pid := nullif(new.raw_user_meta_data->>'player_id', '')::uuid;

  -- (2) staff / admin sin ficha de jugador.
  if v_pid is null then
    insert into profiles (id, email, full_name, role)
    values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'player')
    on conflict (id) do nothing;
    return new;
  end if;

  -- (1) auto-registro de jugador.
  select * into pl from players where id = v_pid and is_active = true;
  if not found then
    raise exception 'Jugador no encontrado.';
  end if;
  if exists (select 1 from profiles where player_id = v_pid) then
    raise exception 'Este jugador ya tiene cuenta.';
  end if;
  if digits_last4(pl.phone) = '' then
    raise exception 'Este jugador no tiene teléfono registrado; pide acceso al organizador.';
  end if;
  v_last4 := new.raw_user_meta_data->>'phone_last4';
  if digits_last4(pl.phone) <> digits_last4(v_last4) then
    raise exception 'Los últimos 4 dígitos del teléfono no coinciden.';
  end if;

  if pl.is_captain or pl.is_cocaptain then
    v_role := 'captain';
  end if;

  insert into profiles (id, email, full_name, role, player_id)
  values (new.id, new.email, pl.full_name, v_role, pl.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sincroniza profiles.role con capitán/co-capitán. Ahora dispara también al
-- cambiar is_cocaptain, y el rol 'captain' se mantiene mientras la ficha sea
-- capitán O co-capitán (nunca toca 'organizer'/'web_manager'/'viewer').
-- (Redefine 0016.)
-- ---------------------------------------------------------------------------
create or replace function sync_captain_role()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_was boolean := coalesce(old.is_captain, false) or coalesce(old.is_cocaptain, false);
  v_is  boolean := new.is_captain or new.is_cocaptain;
begin
  if v_is and not v_was then
    update profiles set role = 'captain' where player_id = new.id and role = 'player';
  elsif v_was and not v_is then
    update profiles set role = 'player' where player_id = new.id and role = 'captain';
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_captain_role on players;
create trigger trg_sync_captain_role
  after update of is_captain, is_cocaptain on players
  for each row execute function sync_captain_role();

-- Sincronización ÚNICA para co-capitanes ya marcados que ya tengan cuenta
-- (por si se marca la bandera por SQL antes de que existan estos triggers).
update profiles p
set role = 'captain'
from players pl
where p.player_id = pl.id and pl.is_cocaptain = true and p.role = 'player';

-- ---------------------------------------------------------------------------
-- Exponer is_cocaptain en la vista pública (para el badge "Co-capitán"). Se
-- AÑADE al final de la lista de columnas: create or replace view solo admite
-- agregar columnas nuevas al final, conservando el orden previo (0026).
-- ---------------------------------------------------------------------------
create or replace view players_public as
select id, season_id, team_id, full_name, gender, category_code,
       is_captain, is_active, photo_url, is_waitlisted, position, is_cocaptain
from players
where is_active = true;

grant select on players_public to anon, authenticated;
