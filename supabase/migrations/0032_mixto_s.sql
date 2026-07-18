-- 0032_mixto_s.sql — Categoría de partido "Mixto S" (3ª Femenil + 4ª Varonil).
-- Se juega a las 10:15 en canchas 6/7/8. Es la 11ª categoría de PARTIDO (no de
-- ranking): los jugadores conservan su ranking FEM_3/VAR_4, se arma 1+1 (como las
-- otras mixtas). Agrega 30 partidos (1 por enfrentamiento × 10 jornadas). No borra
-- nada de lo existente. Idempotente (re-correrla no duplica).

-- Horario matutino 10:15 (los demás son 18:30/19:45/21:00). sort_order 0 = primero.
insert into time_blocks (label, start_time, sort_order) values ('10:15', '10:15:00', 0)
on conflict (label) do nothing;

-- Categoría de partido Mixto S (tipo mixta; NO es categoría de ranking).
insert into match_categories (code, name, type, sort_order, is_active, is_ranking, is_match, match_sort_order)
values ('MIX_S', 'Mixto S', 'mixta', 14, true, false, true, 11)
on conflict (code) do nothing;

-- Elegibilidad: 1 femenil de 3ª + 1 varonil de 4ª.
delete from category_eligibility_rules where match_category_code = 'MIX_S';
insert into category_eligibility_rules (match_category_code, required_gender, required_player_category_code, required_count)
values ('MIX_S', 'female', 'FEM_3', 1), ('MIX_S', 'male', 'VAR_4', 1);

-- Un partido MIX_S por enfrentamiento, a las 10:15; canchas 6/7/8 por jornada.
do $$
declare v_season uuid; v_tb uuid; v_start time; v_n int;
begin
  select id into v_season from seasons where status='active' limit 1;
  if v_season is null then raise exception 'No hay temporada activa.'; end if;
  select id, start_time into v_tb, v_start from time_blocks where label='10:15';

  -- Idempotencia: limpia MIX_S previos de la temporada antes de reinsertar.
  delete from matches
  where category_code='MIX_S'
    and round_id in (select id from rounds where season_id=v_season);

  insert into matches (round_id, team_matchup_id, category_code, time_block_id, court_id, scheduled_at, status)
  select x.round_id, x.tm_id, 'MIX_S', v_tb, ct.id,
         (r.round_date + v_start) at time zone 'America/Mexico_City', 'scheduled'
  from (
    -- Las 3 canchas (6,7,8) se reparten entre los 3 enfrentamientos de cada jornada.
    select tm.id as tm_id, tm.round_id,
           5 + row_number() over (partition by tm.round_id order by tm.team_a_id, tm.id) as court_number
    from team_matchups tm
    join rounds r0 on r0.id = tm.round_id
    where r0.season_id = v_season
  ) x
  join rounds r on r.id = x.round_id
  join courts ct on ct.number = x.court_number;

  get diagnostics v_n = row_count;
  raise notice 'Mixto S: % partidos agregados (esperado 30)', v_n;
  if v_n <> 30 then raise exception 'Se esperaban 30 partidos MIX_S, se insertaron %', v_n; end if;
end $$;
