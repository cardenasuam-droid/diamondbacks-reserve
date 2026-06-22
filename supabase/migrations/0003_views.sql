-- 0003_views.sql
-- Tabla de equipos, duelo directo y ranking individual, todo DERIVADO de
-- match_results. Única fuente de verdad para público y dashboards.

-- ¿Ganó este set (s vs o)? 1 si s>o, 0 en otro caso o si hay nulos.
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
    when raw_sets_won >= 1 then 1                                  -- perdió en 3 sets
    else 0                                                         -- perdió en 2 sets
  end as points
from calc;

-- ---------------------------------------------------------------------------
-- Tabla de posiciones de equipos.
-- Orden: puntos, partidos ganados, dif. sets, dif. juegos, nombre.
-- El DUELO DIRECTO (criterio 5) y la decisión del organizador (6) NO se pueden
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
-- Duelo directo: puntos que cada equipo sumó en sus enfrentamientos contra cada
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
-- Ranking individual. Cada jugador recibe los puntos que ganó su pareja.
-- Orden: puntos aportados, % victorias, partidos ganados, dif sets, dif juegos,
-- menos derrotas, alfabético.
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
