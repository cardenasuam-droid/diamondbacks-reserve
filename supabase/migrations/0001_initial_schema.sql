-- 0001_initial_schema.sql
-- Esquema inicial de la liga de pádel por equipos.
-- Convención: identificadores en inglés. category_code es la clave natural usada
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
-- Catálogos (se llenan en seed.sql)
-- ---------------------------------------------------------------------------

-- Las 9 categorías de partido. Las 7 no-mixtas son también las "categorías de
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
-- inicie sesión. El email se usa para enlazar la cuenta en el primer login.
create table players (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references seasons(id) on delete cascade,
  team_id        uuid not null references teams(id) on delete cascade,
  full_name      text not null,
  email          text,
  phone          text,                           -- privado (ver RLS)
  gender         gender_type not null,
  category_code  text not null references match_categories(code), -- categoría de ranking (no-mixta)
  is_captain     boolean not null default false,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (season_id, email)
);

-- Un solo capitán por equipo (fuente de verdad única para capitán).
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

-- 9 por enfrentamiento (uno por categoría). Cancha + horario directos sobre el
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
  unique (team_matchup_id, category_code),       -- un partido por categoría por enfrentamiento
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
  change_count_used  int not null default 0,     -- informativo; el límite real se valida por logs
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
-- DERIVAN en las vistas (ver 0003). NO se almacenan puntos aquí.
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
  walkover_team_id uuid references teams(id),     -- equipo que NO se presentó
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
-- updated_at automático
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
