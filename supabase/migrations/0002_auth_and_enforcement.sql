-- 0002_auth_and_enforcement.sql
-- Enlace de cuentas en el primer login + validaciones de servidor (lock 1h y
-- límite de 5 cambios por equipo por temporada).

-- ---------------------------------------------------------------------------
-- Al crear un usuario en auth.users (primer OTP), crear su profile y enlazarlo
-- al player que tenga el mismo email. El rol se deriva del player.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  matched_player players%rowtype;
  resolved_role  user_role := 'player';
begin
  select * into matched_player
  from players
  where lower(email) = lower(new.email)
    and is_active = true
  limit 1;

  if matched_player.id is not null and matched_player.is_captain then
    resolved_role := 'captain';
  end if;

  insert into profiles (id, email, full_name, role, player_id)
  values (
    new.id,
    new.email,
    coalesce(matched_player.full_name, new.raw_user_meta_data->>'full_name'),
    resolved_role,
    matched_player.id
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper: ¿el usuario actual es organizador?
create or replace function is_organizer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'organizer'
  );
$$;

-- ---------------------------------------------------------------------------
-- Lock 1 hora antes: ningún capitán puede crear/editar una alineación si ya
-- pasó (primer partido del enfrentamiento - 1h). El organizador sí puede.
-- ---------------------------------------------------------------------------
create or replace function enforce_lineup_lock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  first_match timestamptz;
begin
  if is_organizer() then
    return new;  -- el organizador no tiene candado
  end if;

  select min(m.scheduled_at) into first_match
  from matches m
  where m.team_matchup_id = new.team_matchup_id;

  if first_match is not null and now() > (first_match - interval '1 hour') then
    raise exception
      'Alineación bloqueada: ya pasó el límite de 1 hora antes del partido.';
  end if;

  return new;
end;
$$;

create trigger trg_lineup_lock
  before insert or update on lineups
  for each row execute function enforce_lineup_lock();

-- Mismo candado sobre las entradas de alineación.
create or replace function enforce_entry_lock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  first_match timestamptz;
  mu_id uuid;
begin
  if is_organizer() then
    return new;
  end if;

  select l.team_matchup_id into mu_id from lineups l where l.id = new.lineup_id;
  select min(m.scheduled_at) into first_match
  from matches m where m.team_matchup_id = mu_id;

  if first_match is not null and now() > (first_match - interval '1 hour') then
    raise exception
      'Alineación bloqueada: ya pasó el límite de 1 hora antes del partido.';
  end if;

  return new;
end;
$$;

create trigger trg_entry_lock
  before insert or update on lineup_entries
  for each row execute function enforce_entry_lock();

-- ---------------------------------------------------------------------------
-- Límite de 5 cambios por equipo por temporada.
-- La app escribe un lineup_change_logs por cada partido modificado DESPUÉS del
-- primer envío. Este trigger hace cumplir el tope de 5 logs por equipo/temporada.
-- ---------------------------------------------------------------------------
create or replace function enforce_change_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  used int;
  season uuid;
begin
  if is_organizer() then
    return new;  -- los cambios del organizador no consumen el cupo
  end if;

  select s.id into season
  from rounds r join seasons s on s.id = r.season_id
  where r.id = new.round_id;

  select count(*) into used
  from lineup_change_logs lcl
  join rounds r on r.id = lcl.round_id
  where lcl.team_id = new.team_id
    and r.season_id = season;

  if used >= 5 then
    raise exception
      'Límite alcanzado: el equipo ya usó sus 5 cambios de la temporada.';
  end if;

  return new;
end;
$$;

create trigger trg_change_limit
  before insert on lineup_change_logs
  for each row execute function enforce_change_limit();
