-- 0051_americano_core.sql
-- F2 del plan multi-liga: núcleo del formato AMERICANO (Liga Femenil).
-- Individual con pareja rotativa: cada juego reúne a 4 jugadoras de una
-- categoría (2v2 a 2 de 3 sets); la pareja la asigna el calendario y cambia
-- por jornada. La TABLA es individual por categoría.
--
-- Tablas hermanas de las del formato de equipos, a propósito: forzar
-- team_matchups/lineups sobre un formato individual doblaría ambos modelos.
-- Se reutilizan las piezas neutrales que ya existen: rounds (jornadas),
-- time_blocks, courts, match_categories, los enums match_status/result_status
-- y la filosofía §3.4 (marcadores crudos + vistas derivadas; puntos jamás
-- almacenados). El rating (F5) leerá estos resultados junto con los de
-- equipos en una sola línea de tiempo por persona.

-- ---------------------------------------------------------------------------
-- 1. Juegos individuales
--
-- side 1 / side 2 son las dos parejas; slot 1/2 el lugar dentro de la pareja.
-- phase 'playoffs' queda declarada desde ahora (la fase final se juega con
-- pareja fija, F7); el núcleo de F2 solo opera 'regular'.
-- ---------------------------------------------------------------------------
create table if not exists ind_matches (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references seasons(id) on delete cascade,
  round_id       uuid not null references rounds(id) on delete cascade,
  category_code  text not null references match_categories(code),
  court_id       uuid references courts(id),
  time_block_id  uuid references time_blocks(id),
  scheduled_at   timestamptz,
  phase          text not null default 'regular' check (phase in ('regular', 'playoffs')),
  status         match_status not null default 'scheduled',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Sin choques de cancha/horario dentro de la jornada (espejo de matches).
  unique (round_id, time_block_id, court_id)
);

create index if not exists idx_ind_matches_round  on ind_matches (round_id);
create index if not exists idx_ind_matches_season on ind_matches (season_id, phase);

drop trigger if exists trg_ind_matches_updated_at on ind_matches;
create trigger trg_ind_matches_updated_at
  before update on ind_matches
  for each row execute function set_updated_at();

create table if not exists ind_match_players (
  match_id   uuid not null references ind_matches(id) on delete cascade,
  player_id  uuid not null references players(id),
  side       int not null check (side in (1, 2)),
  slot       int not null check (slot in (1, 2)),
  primary key (match_id, player_id),
  unique (match_id, side, slot)
);

create index if not exists idx_ind_match_players_player on ind_match_players (player_id);

-- Candados de integridad (§3.5: en el servidor, no solo en la UI):
--   (a) la jugadora pertenece a la temporada del juego;
--   (b) una jugadora juega A LO MÁS un juego por jornada.
-- La coherencia de CATEGORÍA (jugadora 5a en juego 5a) es aviso en la UI, no
-- candado: las sustituciones reales a veces cruzan de categoría vecina y la
-- superficie de escritura es solo del organizador.
create or replace function enforce_ind_match_player()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_season uuid;
  v_round  uuid;
begin
  select season_id, round_id into v_season, v_round from ind_matches where id = new.match_id;

  if not exists (
    select 1 from players p where p.id = new.player_id and p.season_id = v_season
  ) then
    raise exception 'La jugadora no pertenece a la temporada de este juego.';
  end if;

  if exists (
    select 1
      from ind_match_players imp
      join ind_matches im on im.id = imp.match_id
     where imp.player_id = new.player_id
       and im.round_id = v_round
       and imp.match_id <> new.match_id
  ) then
    raise exception 'La jugadora ya está programada en otro juego de esta jornada.';
  end if;

  return new;
end $$;

drop trigger if exists trg_ind_match_players_guard on ind_match_players;
create trigger trg_ind_match_players_guard
  before insert or update on ind_match_players
  for each row execute function enforce_ind_match_player();

-- ---------------------------------------------------------------------------
-- 2. Resultados (marcadores crudos + ganador + walkover; nada derivado)
--
-- El organizador captura directo (status 'validated'); el enum result_status
-- se reutiliza para que un flujo de reporte por jugadoras (futuro) no pida
-- otra migración. El walkover se registra 6-0 6-0 para la tabla vía la vista,
-- igual que en equipos.
-- ---------------------------------------------------------------------------
create table if not exists ind_match_results (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null unique references ind_matches(id) on delete cascade,
  reported_by    uuid references profiles(id),
  status         result_status not null default 'validated',
  set1_side1     int, set1_side2 int,
  set2_side1     int, set2_side2 int,
  set3_side1     int, set3_side2 int,
  winner_side    int check (winner_side in (1, 2)),
  is_walkover    boolean not null default false,
  walkover_side  int check (walkover_side in (1, 2)),   -- pareja que NO se presentó
  notes          text,
  validated_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Anti-dedazo (rango, no combinación legal: el organizador debe poder
  -- capturar un retiro). Mismo criterio que 0043/0044 en equipos.
  constraint ind_sets_in_range check (
    coalesce(set1_side1, 0) between 0 and 7 and coalesce(set1_side2, 0) between 0 and 7 and
    coalesce(set2_side1, 0) between 0 and 7 and coalesce(set2_side2, 0) between 0 and 7 and
    coalesce(set3_side1, 0) between 0 and 7 and coalesce(set3_side2, 0) between 0 and 7
  ),
  -- Un walkover trae al ausente y al ganador coherentes, y sin sets.
  constraint ind_walkover_coherent check (
    (not is_walkover and walkover_side is null)
    or (is_walkover and walkover_side is not null and winner_side = 3 - walkover_side
        and set1_side1 is null and set1_side2 is null
        and set2_side1 is null and set2_side2 is null
        and set3_side1 is null and set3_side2 is null)
  )
);

drop trigger if exists trg_ind_match_results_updated_at on ind_match_results;
create trigger trg_ind_match_results_updated_at
  before update on ind_match_results
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Penalizaciones (puntos restados, con motivo) y parejas fijas de playoffs
--
-- points > 0 = puntos que se RESTAN en la tabla (la 5a edición ya usaba esto:
-- "Jugadora | Puntos restados"). El motivo es texto libre del organizador →
-- NO es público (mismo criterio que player_rating_adjustments, 0039); la
-- vista pública expone solo la SUMA de puntos.
-- ---------------------------------------------------------------------------
create table if not exists ind_penalties (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references seasons(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  points      numeric not null check (points > 0),
  reason      text not null,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_ind_penalties_season on ind_penalties (season_id, player_id);

-- Parejas fijas de la fase final (se llenan al cerrar la regular, F7).
create table if not exists season_pairs (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references seasons(id) on delete cascade,
  category_code  text not null references match_categories(code),
  player_1_id    uuid not null references players(id),
  player_2_id    uuid not null references players(id),
  seed           int,
  created_at     timestamptz not null default now(),
  check (player_1_id <> player_2_id),
  unique (season_id, player_1_id),
  unique (season_id, player_2_id)
);

-- ---------------------------------------------------------------------------
-- 4. Vistas derivadas (§3.4). Espejo del pipeline de equipos (0003):
--    per_player_ind_match = una fila por (resultado oficial, jugadora);
--    ind_standings = tabla individual por categoría.
-- ---------------------------------------------------------------------------
create or replace view per_player_ind_match as
with base as (
  select r.id as result_id, r.match_id, im.round_id, im.season_id, im.category_code,
         im.phase, r.is_walkover, r.walkover_side, r.winner_side,
         r.set1_side1, r.set2_side1, r.set3_side1,
         r.set1_side2, r.set2_side2, r.set3_side2
    from ind_match_results r
    join ind_matches im on im.id = r.match_id
   where r.status in ('validated', 'walkover', 'corrected')
),
sides as (
  select base.*, imp.player_id, imp.side,
         case when imp.side = 1 then set1_side1 else set1_side2 end as s1,
         case when imp.side = 1 then set2_side1 else set2_side2 end as s2,
         case when imp.side = 1 then set3_side1 else set3_side2 end as s3,
         case when imp.side = 1 then set1_side2 else set1_side1 end as o1,
         case when imp.side = 1 then set2_side2 else set2_side1 end as o2,
         case when imp.side = 1 then set3_side2 else set3_side1 end as o3
    from base
    join ind_match_players imp on imp.match_id = base.match_id
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
  result_id, match_id, round_id, season_id, category_code, phase, player_id, side,
  case when is_walkover then (side <> walkover_side)
       else side = winner_side end as won,
  case when is_walkover then case when side <> walkover_side then 2 else 0 end
       else raw_sets_won end as sets_won,
  case when is_walkover then case when side <> walkover_side then 0 else 2 end
       else raw_sets_lost end as sets_lost,
  case when is_walkover then case when side <> walkover_side then 12 else 0 end
       else raw_games_won end as games_won,
  case when is_walkover then case when side <> walkover_side then 0 else 12 end
       else raw_games_lost end as games_lost,
  case
    when is_walkover then case when side <> walkover_side then 3 else 0 end
    when side = winner_side then 3                                 -- ganadora
    when raw_sets_won >= 1 then 1                                  -- perdió en 3 sets
    else 0                                                         -- perdió en 2
  end as points
from calc;

-- Tabla individual. Aparecen TODAS las fichas activas fuera de lista de espera
-- de las temporadas americano (con ceros antes de su primer juego). Solo la
-- fase regular puntúa; los playoffs se cuelgan aparte (F7).
-- Orden (hoja de la 5a edición): puntos, dif. partidos, dif. sets, dif.
-- juegos, nombre. Las penalizaciones restan puntos aquí (solo la SUMA; el
-- motivo no es público).
create or replace view ind_standings as
select
  p.id            as player_id,
  p.season_id,
  p.full_name,
  p.category_code,
  p.photo_url,
  count(pim.*)                                    as played,
  coalesce(sum((pim.won)::int), 0)                as won,
  count(pim.*) - coalesce(sum((pim.won)::int), 0) as lost,
  coalesce(sum((pim.won)::int), 0) * 2 - count(pim.*) as match_diff,
  coalesce(sum(pim.points), 0)                    as points_raw,
  coalesce(pen.points, 0)                         as penalty_points,
  coalesce(sum(pim.points), 0) - coalesce(pen.points, 0) as points,
  coalesce(sum(pim.sets_won), 0)                  as sets_won,
  coalesce(sum(pim.sets_lost), 0)                 as sets_lost,
  coalesce(sum(pim.sets_won) - sum(pim.sets_lost), 0)   as set_diff,
  coalesce(sum(pim.games_won), 0)                 as games_won,
  coalesce(sum(pim.games_lost), 0)                as games_lost,
  coalesce(sum(pim.games_won) - sum(pim.games_lost), 0) as game_diff
from players p
join seasons s on s.id = p.season_id
join leagues l on l.id = s.league_id and l.kind = 'americano'
left join per_player_ind_match pim
       on pim.player_id = p.id and pim.phase = 'regular'
left join lateral (
  select sum(points) as points from ind_penalties pe
   where pe.player_id = p.id and pe.season_id = p.season_id
) pen on true
where p.is_active = true and coalesce(p.is_waitlisted, false) = false
group by p.id, p.season_id, p.full_name, p.category_code, p.photo_url, pen.points
order by points desc, match_diff desc, set_diff desc, game_diff desc, full_name asc;

grant select on per_player_ind_match, ind_standings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS y privilegios (patrón 0039/0049)
--
-- Lectura pública del calendario y resultados SOLO con la jornada publicada
-- (rounds.status = 'published') — el organizador arma la jornada en borrador
-- sin que se filtre, mismo candado que 0036 para alineaciones. Escritura:
-- solo organizador. Penalizaciones: ni lectura pública (motivo privado).
-- ---------------------------------------------------------------------------
alter table ind_matches       enable row level security;
alter table ind_match_players enable row level security;
alter table ind_match_results enable row level security;
alter table ind_penalties     enable row level security;
alter table season_pairs      enable row level security;

-- SECURITY INVOKER a propósito: rounds ya es de lectura pública (el rol de la
-- temporada es público), así que no hace falta elevar privilegios — y así no
-- se suma otra función DEFINER ejecutable por anon a los advisors.
create or replace function ind_round_published(p_round uuid)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select exists (select 1 from rounds r where r.id = p_round and r.status = 'published');
$$;

drop policy if exists "public read ind_matches" on ind_matches;
create policy "public read ind_matches" on ind_matches for select
  using (is_organizer() or is_viewer() or ind_round_published(round_id));
drop policy if exists "organizer all ind_matches" on ind_matches;
create policy "organizer all ind_matches" on ind_matches
  for all using (is_organizer()) with check (is_organizer());

drop policy if exists "public read ind_match_players" on ind_match_players;
create policy "public read ind_match_players" on ind_match_players for select
  using (
    is_organizer() or is_viewer()
    or exists (select 1 from ind_matches im
                where im.id = match_id and ind_round_published(im.round_id))
  );
drop policy if exists "organizer all ind_match_players" on ind_match_players;
create policy "organizer all ind_match_players" on ind_match_players
  for all using (is_organizer()) with check (is_organizer());

drop policy if exists "public read ind_match_results" on ind_match_results;
create policy "public read ind_match_results" on ind_match_results for select
  using (
    is_organizer() or is_viewer()
    or exists (select 1 from ind_matches im
                where im.id = match_id and ind_round_published(im.round_id))
  );
drop policy if exists "organizer all ind_match_results" on ind_match_results;
create policy "organizer all ind_match_results" on ind_match_results
  for all using (is_organizer()) with check (is_organizer());

drop policy if exists "organizer all ind_penalties" on ind_penalties;
create policy "organizer all ind_penalties" on ind_penalties
  for all using (is_organizer()) with check (is_organizer());
drop policy if exists "viewer read ind_penalties" on ind_penalties;
create policy "viewer read ind_penalties" on ind_penalties
  for select using (is_viewer());

drop policy if exists "public read season_pairs" on season_pairs;
create policy "public read season_pairs" on season_pairs for select using (true);
drop policy if exists "organizer all season_pairs" on season_pairs;
create policy "organizer all season_pairs" on season_pairs
  for all using (is_organizer()) with check (is_organizer());

revoke all on ind_matches, ind_match_players, ind_match_results, ind_penalties, season_pairs
  from anon, authenticated, public;
grant select on ind_matches, ind_match_players, ind_match_results, season_pairs
  to anon, authenticated;
grant select on ind_penalties to authenticated;
grant insert, update, delete on ind_matches, ind_match_players, ind_match_results,
  ind_penalties, season_pairs to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Jornadas de la 6a Edición femenil: 8 lunes consecutivos desde el 12-oct.
--    En borrador: el organizador publica cada jornada cuando su rol esté listo.
--    Idempotente: solo si la edición aún no tiene jornadas.
-- ---------------------------------------------------------------------------
do $$
declare v_season uuid;
begin
  select s.id into v_season
    from seasons s join leagues l on l.id = s.league_id
   where l.slug = 'femenil' and s.slug = '6a-edicion';

  if v_season is not null
     and not exists (select 1 from rounds r where r.season_id = v_season) then
    insert into rounds (season_id, round_number, name, round_date, status)
    select v_season, i, 'Jornada ' || i, date '2026-10-12' + (i - 1) * 7, 'draft'
      from generate_series(1, 8) as i;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Identidad visual femenil: violeta + azul eléctrico, derivada del wordmark
--    "DIAMONDBACKS" del flyer de la liga pasada (único material de marca
--    disponible; el organizador revisará). El CSS aplicado vive en index.css
--    ([data-league="femenil"]); esto es el registro como datos.
-- ---------------------------------------------------------------------------
update leagues
   set theme = '{"primary": "#7c3aed", "accent": "#38b6f8", "label": "Violeta y Azul (flyer liga pasada)", "provisional": true}'::jsonb
 where slug = 'femenil';
