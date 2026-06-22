-- demo_seed.sql  (OPCIONAL — solo para visualizar la app con datos)
-- Crea una temporada de ejemplo "Liga Demo 2026" con 6 equipos, rosters,
-- 3 jornadas, 81 partidos, resultados validados Y alineaciones (para que el
-- ranking individual tenga datos). Corre en el SQL Editor de Supabase.
--
-- Es RE-EJECUTABLE: borra cualquier demo previa antes de recrearla.
--
-- PARA BORRAR TODO EL DEMO:
--   delete from seasons where name = 'Liga Demo 2026';
--
-- NOTA: desactiva temporalmente los triggers de candado (lock 1h) para poder
-- insertar alineaciones de partidos pasados, y los reactiva al final.

-- Limpieza ordenada: primero las jornadas (cascada a enfrentamientos, partidos,
-- alineaciones y resultados), luego la temporada (cascada a equipos y jugadores).
-- Hace falta el orden porque team_matchups/lineups/match_results referencian
-- teams SIN on delete cascade; no se puede borrar la temporada de un solo golpe.
delete from rounds  where season_id in (select id from seasons where name = 'Liga Demo 2026');
delete from seasons where name = 'Liga Demo 2026';

alter table lineups        disable trigger trg_lineup_lock;
alter table lineup_entries disable trigger trg_entry_lock;

do $$
declare
  v_season uuid;
  team_ids uuid[] := '{}';
  team_names  text[] := array['Halcones','Pumas','Toros','Lobos','Aguilas','Tiburones'];
  team_colors text[] := array['#D72638','#1B4DFF','#2EA44F','#0F172A','#F59E0B','#7C3AED'];
  rank_cats text[] := array['VAR_4','VAR_5','VAR_6','FEM_4','FEM_5','FEM_6','FEM_7'];
  all_cats  text[] := array['VAR_4','VAR_5','VAR_6','FEM_4','FEM_5','FEM_6','FEM_7','MIX_A','MIX_B'];
  rp text[] := array['1,2,3,4,5,6','1,3,2,5,4,6','1,4,2,6,3,5'];  -- 3 parejas por jornada
  tb_ids uuid[];
  court_ids uuid[];
  v_team uuid; v_round uuid; v_mu uuid; v_match uuid; winner uuid;
  lineup_a uuid; lineup_b uuid;
  p1a uuid; p2a uuid; p1b uuid; p2b uuid; arr uuid[];
  ta uuid; tb uuid; cat text;
  ii int; kk int; jj int; r int; mm int; c int;
  parts int[]; slot int; tbi int; cti int;
  rdate date;
  a_wins boolean; two_sets boolean;
  s1a int; s1b int; s2a int; s2b int; s3a int; s3b int;
begin
  select array_agg(id order by sort_order) into tb_ids from time_blocks;
  select array_agg(id order by number)     into court_ids from courts;

  -- Temporada
  insert into seasons(name, status, start_date)
  values ('Liga Demo 2026', 'active', current_date - 21)
  returning id into v_season;

  -- Equipos + rosters (2 jugadores por categoría de ranking = 14 por equipo)
  for ii in 1..6 loop
    insert into teams(season_id, name, color)
    values (v_season, team_names[ii], team_colors[ii])
    returning id into v_team;
    team_ids[ii] := v_team;

    for kk in 1..array_length(rank_cats, 1) loop
      for jj in 1..2 loop
        insert into players(season_id, team_id, full_name, email, gender, category_code, is_captain)
        values (
          v_season, v_team,
          team_names[ii] || ' ' || rank_cats[kk] || '-' || jj,
          lower(team_names[ii]) || '.' || lower(rank_cats[kk]) || '.' || jj || '@demo.test',
          case when rank_cats[kk] like 'VAR%' then 'male'::gender_type else 'female'::gender_type end,
          rank_cats[kk],
          (kk = 1 and jj = 1)  -- capitán: el primer jugador del equipo
        );
      end loop;
    end loop;
  end loop;

  -- Jornadas, enfrentamientos, partidos, resultados y alineaciones
  for r in 1..3 loop
    rdate := current_date - (21 - r * 7);
    insert into rounds(season_id, round_number, name, round_date, status)
    values (v_season, r, 'Jornada ' || r, rdate, 'published')
    returning id into v_round;

    parts := string_to_array(rp[r], ',')::int[];
    slot := 0;

    for mm in 0..2 loop
      ta := team_ids[ parts[mm * 2 + 1] ];  -- team_a = índice menor (más fuerte)
      tb := team_ids[ parts[mm * 2 + 2] ];
      insert into team_matchups(round_id, team_a_id, team_b_id)
      values (v_round, ta, tb)
      returning id into v_mu;

      -- una alineación por equipo en el enfrentamiento
      insert into lineups(team_matchup_id, team_id, status) values (v_mu, ta, 'validated') returning id into lineup_a;
      insert into lineups(team_matchup_id, team_id, status) values (v_mu, tb, 'validated') returning id into lineup_b;

      for c in 1..9 loop
        cat := all_cats[c];
        tbi := slot / 9;          -- 0,1,2  (bloque de horario)
        cti := slot % 9;          -- 0..8   (cancha)
        insert into matches(round_id, team_matchup_id, category_code, time_block_id, court_id, scheduled_at, status)
        values (
          v_round, v_mu, cat, tb_ids[tbi + 1], court_ids[cti + 1],
          ((rdate + time '18:30') + (tbi * interval '75 minutes'))::timestamptz,
          'completed'
        )
        returning id into v_match;
        slot := slot + 1;

        -- Resultado: gana el equipo más fuerte (team_a) salvo "sorpresa".
        a_wins   := (c % 4 <> 0);
        two_sets := (c % 2 = 0);
        s3a := null; s3b := null;
        if a_wins then
          winner := ta;
          if two_sets then s1a:=6; s1b:=2; s2a:=6; s2b:=3;
          else s1a:=6; s1b:=4; s2a:=4; s2b:=6; s3a:=6; s3b:=3; end if;
        else
          winner := tb;
          if two_sets then s1a:=2; s1b:=6; s2a:=3; s2b:=6;
          else s1a:=4; s1b:=6; s2a:=6; s2b:=4; s3a:=3; s3b:=6; end if;
        end if;

        insert into match_results(
          match_id, status, set1_team_a, set1_team_b, set2_team_a, set2_team_b,
          set3_team_a, set3_team_b, winner_team_id, is_walkover)
        values (v_match, 'validated', s1a, s1b, s2a, s2b, s3a, s3b, winner, false);

        -- Alineación por categoría: 2 jugadores elegibles por equipo.
        if cat = 'MIX_A' then
          select id into p1a from players where team_id = ta and category_code = 'VAR_5' order by full_name limit 1;
          select id into p2a from players where team_id = ta and category_code = 'FEM_4' order by full_name limit 1;
          select id into p1b from players where team_id = tb and category_code = 'VAR_5' order by full_name limit 1;
          select id into p2b from players where team_id = tb and category_code = 'FEM_4' order by full_name limit 1;
        elsif cat = 'MIX_B' then
          select id into p1a from players where team_id = ta and category_code = 'VAR_6' order by full_name limit 1;
          select id into p2a from players where team_id = ta and category_code = 'FEM_5' order by full_name limit 1;
          select id into p1b from players where team_id = tb and category_code = 'VAR_6' order by full_name limit 1;
          select id into p2b from players where team_id = tb and category_code = 'FEM_5' order by full_name limit 1;
        else
          select array_agg(id order by full_name) into arr from players where team_id = ta and category_code = cat;
          p1a := arr[1]; p2a := arr[2];
          select array_agg(id order by full_name) into arr from players where team_id = tb and category_code = cat;
          p1b := arr[1]; p2b := arr[2];
        end if;

        insert into lineup_entries(lineup_id, match_id, category_code, player_1_id, player_2_id)
        values (lineup_a, v_match, cat, p1a, p2a);
        insert into lineup_entries(lineup_id, match_id, category_code, player_1_id, player_2_id)
        values (lineup_b, v_match, cat, p1b, p2b);
      end loop;
    end loop;
  end loop;

  raise notice 'Demo creado: temporada %, 6 equipos, 3 jornadas, 81 partidos, con alineaciones.', v_season;
end$$;

alter table lineups        enable trigger trg_lineup_lock;
alter table lineup_entries enable trigger trg_entry_lock;
