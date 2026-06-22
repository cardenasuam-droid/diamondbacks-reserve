-- _apply_all.sql  (GENERADO automaticamente)
-- Pega TODO este archivo en el SQL Editor de Supabase y pulsa Run, UNA sola vez,
-- sobre un proyecto recien creado (vacio).
-- Orden: 0001 esquema -> 0002 auth/triggers -> 0003 vistas -> 0004 RLS -> seed datos.

-- ============================================================
-- >>> 0001_initial_schema.sql
-- ============================================================
-- 0001_initial_schema.sql
-- Esquema inicial de la liga de pÃ¡del por equipos.
-- ConvenciÃ³n: identificadores en inglÃ©s. category_code es la clave natural usada
-- en toda la app (coincide con el plan y los CSV).

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type gender_type        as enum ('male', 'female');
create type category_type      as enum ('varonil', 'femenil', 'mixta');
create type user_role          as enum ('player', 'captain', 'organizer', 'web_manager');
create type season_status      as enum ('draft', 'active', 'finished');
create type round_status       as enum ('draft', 'published', 'finished');
create type match_status       as enum ('scheduled', 'in_progress', 'completed', 'walkover');
create type lineup_status      as enum ('draft', 'submitted', 'modified', 'locked', 'validated', 'admin_edited');
create type result_status      as enum ('pending_report', 'reported', 'validated', 'disputed', 'walkover', 'corrected');

-- ---------------------------------------------------------------------------
-- CatÃ¡logos (se llenan en seed.sql)
-- ---------------------------------------------------------------------------

-- Las 9 categorÃ­as de partido. Las 7 no-mixtas son tambiÃ©n las "categorÃ­as de
-- ranking" que puede tener un jugador.
create table match_categories (
  code        text primary key,                 -- VAR_4, FEM_7, MIX_A, ...
  name        text not null,                     -- "4a Varonil"
  type        category_type not null,
  sort_order  int not null,
  is_active   boolean not null default true
);

-- Reglas de elegibilidad data-driven. Una fila por requisito.
--   VAR_4  -> (male,   VAR_4, 2)
--   MIX_A  -> (male,   VAR_5, 1) + (female, FEM_4, 1)
create table category_eligibility_rules (
  id                            uuid primary key default gen_random_uuid(),
  match_category_code           text not null references match_categories(code),
  required_gender               gender_type not null,
  required_player_category_code text not null references match_categories(code),
  required_count                int not null check (required_count > 0)
);

create table time_blocks (
  id          uuid primary key default gen_random_uuid(),
  label       text not null unique,              -- "18:30"
  start_time  time not null,
  sort_order  int not null
);

create table courts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                      -- "Cancha 1"
  number     int not null unique,
  is_active  boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Temporada y equipos
-- ---------------------------------------------------------------------------
create table seasons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  start_date  date,
  end_date    date,
  status      season_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table teams (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references seasons(id) on delete cascade,
  name        text not null,
  color       text,                              -- hex, p. ej. #D72638
  logo_url    text,
  slogan      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (season_id, name)
);

-- Ficha de roster. Fuente de verdad deportiva. Existe aunque el jugador nunca
-- inicie sesiÃ³n. El email se usa para enlazar la cuenta en el primer login.
create table players (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references seasons(id) on delete cascade,
  team_id        uuid not null references teams(id) on delete cascade,
  full_name      text not null,
  email          text,
  phone          text,                           -- privado (ver RLS)
  gender         gender_type not null,
  category_code  text not null references match_categories(code), -- categorÃ­a de ranking (no-mixta)
  is_captain     boolean not null default false,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (season_id, email)
);

-- Un solo capitÃ¡n por equipo (fuente de verdad Ãºnica para capitÃ¡n).
create unique index one_captain_per_team
  on players (team_id) where (is_captain = true);

-- ---------------------------------------------------------------------------
-- Cuentas de usuario (se crean en el primer login; ver 0002)
-- ---------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  role        user_role not null default 'player',
  player_id   uuid references players(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Calendario / rol
-- ---------------------------------------------------------------------------
create table rounds (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references seasons(id) on delete cascade,
  round_number  int not null,
  name          text,
  round_date    date,
  status        round_status not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (season_id, round_number)
);

-- 3 por jornada.
create table team_matchups (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid not null references rounds(id) on delete cascade,
  team_a_id   uuid not null references teams(id),
  team_b_id   uuid not null references teams(id),
  status      text not null default 'scheduled',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (team_a_id <> team_b_id)
);

-- 9 por enfrentamiento (uno por categorÃ­a). Cancha + horario directos sobre el
-- partido: el UNIQUE evita choques de cancha/horario en una jornada.
create table matches (
  id               uuid primary key default gen_random_uuid(),
  round_id         uuid not null references rounds(id) on delete cascade,
  team_matchup_id  uuid not null references team_matchups(id) on delete cascade,
  category_code    text not null references match_categories(code),
  time_block_id    uuid not null references time_blocks(id),
  court_id         uuid not null references courts(id),
  scheduled_at     timestamptz,                  -- round_date + time_block (para el lock)
  status           match_status not null default 'scheduled',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (team_matchup_id, category_code),       -- un partido por categorÃ­a por enfrentamiento
  unique (round_id, time_block_id, court_id)     -- sin choques de cancha/horario
);

-- ---------------------------------------------------------------------------
-- Alineaciones
-- ---------------------------------------------------------------------------
create table lineups (
  id                 uuid primary key default gen_random_uuid(),
  team_matchup_id    uuid not null references team_matchups(id) on delete cascade,
  team_id            uuid not null references teams(id),
  submitted_by       uuid references profiles(id),
  status             lineup_status not null default 'draft',
  submitted_at       timestamptz,
  locked_at          timestamptz,
  change_count_used  int not null default 0,     -- informativo; el lÃ­mite real se valida por logs
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (team_matchup_id, team_id)
);

create table lineup_entries (
  id             uuid primary key default gen_random_uuid(),
  lineup_id      uuid not null references lineups(id) on delete cascade,
  match_id       uuid not null references matches(id),
  category_code  text not null references match_categories(code),
  player_1_id    uuid references players(id),
  player_2_id    uuid references players(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (lineup_id, category_code),
  check (player_1_id is null or player_1_id <> player_2_id)
);

create table lineup_change_logs (
  id             uuid primary key default gen_random_uuid(),
  lineup_id      uuid not null references lineups(id) on delete cascade,
  team_id        uuid not null references teams(id),
  round_id       uuid not null references rounds(id),
  match_id       uuid references matches(id),
  changed_by     uuid references profiles(id),
  change_number  int,
  before_data    jsonb,
  after_data     jsonb,
  reason         text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Resultados
-- Solo se guardan marcadores + ganador + walkover. Los puntos/sets/juegos se
-- DERIVAN en las vistas (ver 0003). NO se almacenan puntos aquÃ­.
-- ---------------------------------------------------------------------------
create table match_results (
  id               uuid primary key default gen_random_uuid(),
  match_id         uuid not null unique references matches(id) on delete cascade,
  reported_by      uuid references profiles(id),
  validated_by     uuid references profiles(id),
  status           result_status not null default 'pending_report',
  set1_team_a      int, set1_team_b int,
  set2_team_a      int, set2_team_b int,
  set3_team_a      int, set3_team_b int,
  winner_team_id   uuid references teams(id),
  is_walkover      boolean not null default false,
  walkover_team_id uuid references teams(id),     -- equipo que NO se presentÃ³
  notes            text,
  created_at       timestamptz not null default now(),
  validated_at     timestamptz,
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Contenido
-- ---------------------------------------------------------------------------
create table news_posts (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  body            text,
  image_url       text,
  audience        text not null default 'public', -- public | players | captains | team
  target_team_id  uuid references teams(id),
  published       boolean not null default false,
  published_at    timestamptz,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table league_documents (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  file_url       text not null,
  document_type  text not null default 'reglamento',
  version        text,
  is_active      boolean not null default true,
  uploaded_by    uuid references profiles(id),
  created_at     timestamptz not null default now()
);

create table notifications (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  body            text,
  target_role     user_role,
  target_team_id  uuid references teams(id),
  target_user_id  uuid references profiles(id),
  channel         text not null default 'in_app',
  status          text not null default 'pending',
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

-- ---------------------------------------------------------------------------
-- updated_at automÃ¡tico
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'seasons','teams','players','profiles','rounds','team_matchups',
      'matches','lineups','lineup_entries','match_results','news_posts'
    ])
  loop
    execute format(
      'create trigger trg_%1$s_updated_at before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end$$;


-- ============================================================
-- >>> 0002_auth_and_enforcement.sql
-- ============================================================
-- 0002_auth_and_enforcement.sql
-- Enlace de cuentas en el primer login + validaciones de servidor (lock 1h y
-- lÃ­mite de 5 cambios por equipo por temporada).

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

-- Helper: Â¿el usuario actual es organizador?
create or replace function is_organizer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'organizer'
  );
$$;

-- ---------------------------------------------------------------------------
-- Lock 1 hora antes: ningÃºn capitÃ¡n puede crear/editar una alineaciÃ³n si ya
-- pasÃ³ (primer partido del enfrentamiento - 1h). El organizador sÃ­ puede.
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
      'AlineaciÃ³n bloqueada: ya pasÃ³ el lÃ­mite de 1 hora antes del partido.';
  end if;

  return new;
end;
$$;

create trigger trg_lineup_lock
  before insert or update on lineups
  for each row execute function enforce_lineup_lock();

-- Mismo candado sobre las entradas de alineaciÃ³n.
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
      'AlineaciÃ³n bloqueada: ya pasÃ³ el lÃ­mite de 1 hora antes del partido.';
  end if;

  return new;
end;
$$;

create trigger trg_entry_lock
  before insert or update on lineup_entries
  for each row execute function enforce_entry_lock();

-- ---------------------------------------------------------------------------
-- LÃ­mite de 5 cambios por equipo por temporada.
-- La app escribe un lineup_change_logs por cada partido modificado DESPUÃ‰S del
-- primer envÃ­o. Este trigger hace cumplir el tope de 5 logs por equipo/temporada.
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
      'LÃ­mite alcanzado: el equipo ya usÃ³ sus 5 cambios de la temporada.';
  end if;

  return new;
end;
$$;

create trigger trg_change_limit
  before insert on lineup_change_logs
  for each row execute function enforce_change_limit();


-- ============================================================
-- >>> 0003_views.sql
-- ============================================================
-- 0003_views.sql
-- Tabla de equipos, duelo directo y ranking individual, todo DERIVADO de
-- match_results. Ãšnica fuente de verdad para pÃºblico y dashboards.

-- Â¿GanÃ³ este set (s vs o)? 1 si s>o, 0 en otro caso o si hay nulos.
create or replace function set_won(s int, o int)
returns int language sql immutable as $$
  select case when s is null or o is null then 0
              when s > o then 1 else 0 end;
$$;

-- ---------------------------------------------------------------------------
-- Una fila por (resultado, equipo): puntos, sets y juegos de ese equipo en ese
-- partido. Solo resultados oficiales. Walkover se calcula de forma determinista.
-- ---------------------------------------------------------------------------
create or replace view per_team_match as
with base as (
  select mr.id as result_id, mr.match_id, m.round_id, rd.season_id,
         m.team_matchup_id, tm.team_a_id, tm.team_b_id,
         mr.is_walkover, mr.walkover_team_id,
         mr.set1_team_a, mr.set2_team_a, mr.set3_team_a,
         mr.set1_team_b, mr.set2_team_b, mr.set3_team_b
  from match_results mr
  join matches m        on m.id  = mr.match_id
  join team_matchups tm on tm.id = m.team_matchup_id
  join rounds rd        on rd.id = m.round_id
  where mr.status in ('validated', 'walkover', 'corrected')
),
sides as (
  -- lado A
  select result_id, match_id, round_id, season_id, team_matchup_id,
         team_a_id as team_id, team_b_id as opponent_id, is_walkover, walkover_team_id,
         set1_team_a as s1, set2_team_a as s2, set3_team_a as s3,
         set1_team_b as o1, set2_team_b as o2, set3_team_b as o3
  from base
  union all
  -- lado B
  select result_id, match_id, round_id, season_id, team_matchup_id,
         team_b_id, team_a_id, is_walkover, walkover_team_id,
         set1_team_b, set2_team_b, set3_team_b,
         set1_team_a, set2_team_a, set3_team_a
  from base
),
calc as (
  select *,
    (set_won(s1,o1) + set_won(s2,o2) + set_won(s3,o3)) as raw_sets_won,
    (set_won(o1,s1) + set_won(o2,s2) + set_won(o3,s3)) as raw_sets_lost,
    (coalesce(s1,0) + coalesce(s2,0) + coalesce(s3,0)) as raw_games_won,
    (coalesce(o1,0) + coalesce(o2,0) + coalesce(o3,0)) as raw_games_lost
  from sides
)
select
  result_id, match_id, round_id, season_id, team_matchup_id, team_id, opponent_id,
  case when is_walkover then (team_id <> walkover_team_id)
       else raw_sets_won > raw_sets_lost end as won,
  case
    when is_walkover then case when team_id <> walkover_team_id then 2 else 0 end
    else raw_sets_won end as sets_won,
  case
    when is_walkover then case when team_id <> walkover_team_id then 0 else 2 end
    else raw_sets_lost end as sets_lost,
  case
    when is_walkover then case when team_id <> walkover_team_id then 12 else 0 end
    else raw_games_won end as games_won,
  case
    when is_walkover then case when team_id <> walkover_team_id then 0 else 12 end
    else raw_games_lost end as games_lost,
  case
    when is_walkover then case when team_id <> walkover_team_id then 3 else 0 end
    when raw_sets_won > raw_sets_lost then 3                       -- ganador
    when raw_sets_won >= 1 then 1                                  -- perdiÃ³ en 3 sets
    else 0                                                         -- perdiÃ³ en 2 sets
  end as points
from calc;

-- ---------------------------------------------------------------------------
-- Tabla de posiciones de equipos.
-- Orden: puntos, partidos ganados, dif. sets, dif. juegos, nombre.
-- El DUELO DIRECTO (criterio 5) y la decisiÃ³n del organizador (6) NO se pueden
-- expresar en este ORDER BY: se resuelven en la app sobre los empates usando la
-- vista head_to_head de abajo.
-- ---------------------------------------------------------------------------
create or replace view team_standings as
select
  t.id   as team_id,
  t.season_id,
  t.name as team_name,
  t.color,
  count(ptm.*)                                  as played,
  coalesce(sum((ptm.won)::int), 0)              as won,
  count(ptm.*) - coalesce(sum((ptm.won)::int),0) as lost,
  coalesce(sum(ptm.points), 0)                  as points,
  coalesce(sum(ptm.sets_won), 0)                as sets_won,
  coalesce(sum(ptm.sets_lost), 0)               as sets_lost,
  coalesce(sum(ptm.sets_won) - sum(ptm.sets_lost), 0)   as set_diff,
  coalesce(sum(ptm.games_won), 0)               as games_won,
  coalesce(sum(ptm.games_lost), 0)              as games_lost,
  coalesce(sum(ptm.games_won) - sum(ptm.games_lost), 0) as game_diff
from teams t
left join per_team_match ptm on ptm.team_id = t.id
group by t.id, t.season_id, t.name, t.color
order by points desc, won desc, set_diff desc, game_diff desc, team_name asc;

-- ---------------------------------------------------------------------------
-- Duelo directo: puntos que cada equipo sumÃ³ en sus enfrentamientos contra cada
-- rival. La app, ante un empate en (puntos, ganados, dif sets, dif juegos),
-- compara estos puntos SOLO entre los equipos empatados.
-- ---------------------------------------------------------------------------
create or replace view head_to_head as
select season_id, team_id, opponent_id,
       coalesce(sum(points), 0) as points_vs_opponent,
       coalesce(sum((won)::int), 0) as matches_won_vs_opponent
from per_team_match
group by season_id, team_id, opponent_id;

-- ---------------------------------------------------------------------------
-- Ranking individual. Cada jugador recibe los puntos que ganÃ³ su pareja.
-- Orden: puntos aportados, % victorias, partidos ganados, dif sets, dif juegos,
-- menos derrotas, alfabÃ©tico.
-- ---------------------------------------------------------------------------
create or replace view player_rankings as
with player_matches as (
  select pl.player_id,
         ptm.points, ptm.won, ptm.sets_won, ptm.sets_lost,
         ptm.games_won, ptm.games_lost
  from lineup_entries le
  join lineups l         on l.id = le.lineup_id
  join per_team_match ptm on ptm.match_id = le.match_id and ptm.team_id = l.team_id
  cross join lateral (values (le.player_1_id), (le.player_2_id)) as pl(player_id)
  where pl.player_id is not null
)
select
  p.id   as player_id,
  p.full_name,
  p.team_id,
  p.category_code,
  count(pm.*)                                  as matches_played,
  coalesce(sum((pm.won)::int), 0)              as matches_won,
  count(pm.*) - coalesce(sum((pm.won)::int),0) as matches_lost,
  case when count(pm.*) = 0 then 0
       else round(100.0 * sum((pm.won)::int) / count(pm.*), 1) end as win_percentage,
  coalesce(sum(pm.points), 0)                  as points_contributed,
  coalesce(sum(pm.sets_won), 0)                as sets_won,
  coalesce(sum(pm.sets_lost), 0)               as sets_lost,
  coalesce(sum(pm.sets_won) - sum(pm.sets_lost), 0)     as set_diff,
  coalesce(sum(pm.games_won), 0)               as games_won,
  coalesce(sum(pm.games_lost), 0)              as games_lost,
  coalesce(sum(pm.games_won) - sum(pm.games_lost), 0)   as game_diff
from players p
left join player_matches pm on pm.player_id = p.id
group by p.id, p.full_name, p.team_id, p.category_code
order by points_contributed desc, win_percentage desc, matches_won desc,
         set_diff desc, game_diff desc, matches_lost asc, full_name asc;


-- ============================================================
-- >>> 0004_rls.sql
-- ============================================================
-- 0004_rls.sql
-- RLS base. Evita el footgun de "todo abierto": en Supabase, sin polÃ­ticas y con
-- RLS activado, la anon key no lee nada. AquÃ­ se abre SOLO lo pÃºblico y se da al
-- organizador acceso amplio. Las polÃ­ticas finas de capitÃ¡n/jugador se refinan
-- por mÃ³dulo (ver CLAUDE.md). Marcadas como TODO abajo.

-- ---------------------------------------------------------------------------
-- Activar RLS en todo
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array[
    'seasons','teams','players','profiles','rounds','team_matchups','matches',
    'match_categories','category_eligibility_rules','time_blocks','courts',
    'lineups','lineup_entries','lineup_change_logs','match_results',
    'news_posts','league_documents','notifications'
  ])
  loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- Vista pÃºblica de jugadores: SIN telÃ©fono ni correo. El pÃºblico lee rosters
-- desde aquÃ­, nunca desde la tabla players directamente.
-- ---------------------------------------------------------------------------
create or replace view players_public as
select id, season_id, team_id, full_name, gender, category_code,
       is_captain, is_active
from players
where is_active = true;

grant select on players_public, team_standings, head_to_head, player_rankings
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lectura pÃºblica de datos deportivos
-- ---------------------------------------------------------------------------
create policy "public read seasons"     on seasons     for select using (true);
create policy "public read teams"        on teams       for select using (true);
create policy "public read rounds"       on rounds      for select using (status = 'published' or is_organizer());
create policy "public read matchups"     on team_matchups for select using (true);
create policy "public read matches"      on matches     for select using (true);
create policy "public read categories"   on match_categories for select using (true);
create policy "public read elig"         on category_eligibility_rules for select using (true);
create policy "public read timeblocks"   on time_blocks for select using (true);
create policy "public read courts"       on courts      for select using (true);
create policy "public read results"      on match_results for select using (true);
create policy "public read news"         on news_posts  for select using (published = true or is_organizer());
create policy "public read docs"         on league_documents for select using (is_active = true or is_organizer());

-- players: el pÃºblico usa players_public (vista). La tabla cruda solo la leen:
--   - el organizador (todo)
--   - el propio jugador (su fila)
--   - el capitÃ¡n (jugadores de su equipo)  [TODO: afinar contacto]
create policy "players self read" on players for select
  using (
    is_organizer()
    or exists (select 1 from profiles pr where pr.id = auth.uid() and pr.player_id = players.id)
    or exists (
      select 1 from profiles pr join players me on me.id = pr.player_id
      where pr.id = auth.uid() and me.is_captain = true and me.team_id = players.team_id
    )
  );

-- profiles: cada quien lee su propio profile; el organizador lee todos.
create policy "profiles self read" on profiles for select
  using (id = auth.uid() or is_organizer());
create policy "profiles self update" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Escritura del organizador: acceso amplio (ALL) en tablas administrativas.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array[
    'seasons','teams','players','rounds','team_matchups','matches',
    'match_categories','category_eligibility_rules','time_blocks','courts',
    'lineups','lineup_entries','lineup_change_logs','match_results',
    'news_posts','league_documents','notifications'
  ])
  loop
    execute format(
      'create policy "organizer all" on %I for all using (is_organizer()) with check (is_organizer());', t);
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- TODO (refinar por mÃ³dulo, ver plan secciones 12 y 18):
--   * CapitÃ¡n: insert/update de lineups y lineup_entries SOLO de su equipo,
--     respetando el lock y el lÃ­mite de cambios (los triggers ya lo blindan).
--   * CapitÃ¡n: insert de match_results (estado 'reported') SOLO de partidos de
--     su equipo; nunca 'validated'.
--   * Web manager: insert/update de news_posts y league_documents.
--   * Jugador: read de notifications dirigidas a Ã©l / su equipo / su rol.
-- ---------------------------------------------------------------------------


-- ============================================================
-- >>> seed.sql
-- ============================================================
-- seed.sql
-- Datos fijos que no dependen de la temporada concreta. Idempotente.

-- ---------------------------------------------------------------------------
-- CategorÃ­as de partido (9). Las 7 no-mixtas son tambiÃ©n categorÃ­as de ranking.
-- ---------------------------------------------------------------------------
insert into match_categories (code, name, type, sort_order) values
  ('VAR_4', '4a Varonil', 'varonil', 1),
  ('VAR_5', '5a Varonil', 'varonil', 2),
  ('VAR_6', '6a Varonil', 'varonil', 3),
  ('FEM_4', '4a Femenil', 'femenil', 4),
  ('FEM_5', '5a Femenil', 'femenil', 5),
  ('FEM_6', '6a Femenil', 'femenil', 6),
  ('FEM_7', '7a Femenil', 'femenil', 7),
  ('MIX_A', 'Mixta A',    'mixta',   8),
  ('MIX_B', 'Mixta B',    'mixta',   9)
on conflict (code) do update
  set name = excluded.name, type = excluded.type, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Reglas de elegibilidad (data-driven). La validaciÃ³n de alineaciÃ³n lee esto.
-- ---------------------------------------------------------------------------
delete from category_eligibility_rules;
insert into category_eligibility_rules
  (match_category_code, required_gender, required_player_category_code, required_count) values
  ('VAR_4', 'male',   'VAR_4', 2),
  ('VAR_5', 'male',   'VAR_5', 2),
  ('VAR_6', 'male',   'VAR_6', 2),
  ('FEM_4', 'female', 'FEM_4', 2),
  ('FEM_5', 'female', 'FEM_5', 2),
  ('FEM_6', 'female', 'FEM_6', 2),
  ('FEM_7', 'female', 'FEM_7', 2),
  ('MIX_A', 'male',   'VAR_5', 1),
  ('MIX_A', 'female', 'FEM_4', 1),
  ('MIX_B', 'male',   'VAR_6', 1),
  ('MIX_B', 'female', 'FEM_5', 1);

-- ---------------------------------------------------------------------------
-- Horarios (3)
-- ---------------------------------------------------------------------------
insert into time_blocks (label, start_time, sort_order) values
  ('18:30', '18:30', 1),
  ('19:45', '19:45', 2),
  ('21:00', '21:00', 3)
on conflict (label) do update
  set start_time = excluded.start_time, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Canchas (9)
-- ---------------------------------------------------------------------------
insert into courts (name, number) values
  ('Cancha 1', 1), ('Cancha 2', 2), ('Cancha 3', 3),
  ('Cancha 4', 4), ('Cancha 5', 5), ('Cancha 6', 6),
  ('Cancha 7', 7), ('Cancha 8', 8), ('Cancha 9', 9)
on conflict (number) do update set name = excluded.name;


