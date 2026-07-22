-- 0046_j2_legacy_swap_suma13_var5.sql
-- Jornada 2, Legacy vs Peak Padel: SUMA13_FEM y VAR_5 intercambian su horario.
--
--   SUMA13_FEM  19:45 Cancha 5  ->  21:00 Cancha 7
--   VAR_5       21:00 Cancha 7  ->  19:45 Cancha 5
--
-- POR QUÉ TAMBIÉN CAMBIA LA CANCHA. A las 19:45 y a las 21:00 de la J2 están
-- ocupadas LAS DIEZ canchas (verificado). Mover solo la hora dejando cada
-- partido en la suya es imposible: VAR_5 a las 19:45 en la Cancha 7 chocaría con
-- SUMA7_FEM, que ya está ahí. El único movimiento posible es el intercambio
-- completo del espacio — cada partido toma la hora Y la cancha del otro.
--
-- POR QUÉ HACE FALTA UN APARCAMIENTO. unique(round_id, time_block_id, court_id)
-- no es aplazable, así que un intercambio directo falla: al mover el primero,
-- todavía existe el segundo en el destino. Como no queda ningún hueco libre en
-- esas dos franjas, se aparca uno de los dos en una cancha libre de OTRA franja
-- de la misma jornada, se mueve el otro, y se coloca el primero en su destino.
-- Todo dentro de un bloque: si algo falla, no queda nada a medias.
--
-- scheduled_at se recalcula desde la fecha de la jornada y la hora del bloque,
-- convertido a hora de México — no se copia a mano — porque gobierna el orden
-- del rating y la pantalla "Mis próximos partidos".

do $$
declare
  v_round      uuid;
  v_round_date date;
  v_suma13     uuid;
  v_var5       uuid;
  v_tb_1945    uuid;
  v_tb_2100    uuid;
  v_court_5    uuid;
  v_court_7    uuid;
  v_park_tb    uuid;
  v_park_court uuid;
  v_ya         int;
begin
  select id, round_date into v_round, v_round_date from rounds where round_number = 2;
  if v_round is null then raise exception 'No existe la jornada 2.'; end if;

  -- Los dos partidos del enfrentamiento donde juega Legacy en la J2.
  select m.id into v_suma13
  from matches m
  join team_matchups tm on tm.id = m.team_matchup_id
  join teams a on a.id = tm.team_a_id
  join teams b on b.id = tm.team_b_id
  where m.round_id = v_round and m.category_code = 'SUMA13_FEM'
    and (a.name ilike '%legacy%' or b.name ilike '%legacy%');

  select m.id into v_var5
  from matches m
  join team_matchups tm on tm.id = m.team_matchup_id
  join teams a on a.id = tm.team_a_id
  join teams b on b.id = tm.team_b_id
  where m.round_id = v_round and m.category_code = 'VAR_5'
    and (a.name ilike '%legacy%' or b.name ilike '%legacy%');

  if v_suma13 is null or v_var5 is null then
    raise exception 'No se encontraron los dos partidos de Legacy en la J2.';
  end if;

  select id into v_tb_1945 from time_blocks where label = '19:45';
  select id into v_tb_2100 from time_blocks where label = '21:00';
  select id into v_court_5 from courts where name = 'Cancha 5';
  select id into v_court_7 from courts where name = 'Cancha 7';

  -- Idempotencia: si ya está intercambiado, no se toca nada.
  select count(*) into v_ya
  from matches
  where id = v_suma13 and time_block_id = v_tb_2100 and court_id = v_court_7;
  if v_ya = 1 then
    raise notice 'El intercambio ya estaba hecho: no se cambia nada.';
    return;
  end if;

  -- Comprobación de que el punto de partida es el esperado. Si el calendario
  -- cambió, mejor abortar que mover partidos a ciegas.
  if not exists (
    select 1 from matches
    where id = v_suma13 and time_block_id = v_tb_1945 and court_id = v_court_5
  ) or not exists (
    select 1 from matches
    where id = v_var5 and time_block_id = v_tb_2100 and court_id = v_court_7
  ) then
    raise exception 'Los partidos no están donde se esperaba (SUMA13 19:45/C5 y VAR_5 21:00/C7). Revisa el calendario antes de mover nada.';
  end if;

  -- Aparcamiento: cualquier (franja, cancha) libre de esta jornada.
  select tb.id, c.id into v_park_tb, v_park_court
  from time_blocks tb
  cross join courts c
  where not exists (
    select 1 from matches m
    where m.round_id = v_round and m.time_block_id = tb.id and m.court_id = c.id
  )
  limit 1;

  if v_park_tb is null then
    raise exception 'No hay ningún espacio libre en la jornada 2 para hacer el intercambio.';
  end if;

  -- 1) VAR_5 al aparcamiento  2) SUMA13 al destino  3) VAR_5 a su destino.
  update matches set time_block_id = v_park_tb, court_id = v_park_court where id = v_var5;
  update matches set time_block_id = v_tb_2100, court_id = v_court_7   where id = v_suma13;
  update matches set time_block_id = v_tb_1945, court_id = v_court_5   where id = v_var5;

  -- scheduled_at coherente con la franja nueva, en hora de México.
  update matches m
  set scheduled_at = ((v_round_date + tb.start_time) at time zone 'America/Mexico_City')
  from time_blocks tb
  where tb.id = m.time_block_id and m.id in (v_suma13, v_var5);

  raise notice 'Intercambio hecho: SUMA13_FEM a 21:00/Cancha 7 y VAR_5 a 19:45/Cancha 5.';
end $$;

-- ---------------------------------------------------------------------------
-- Comprobación final: nadie puede haber quedado aparcado ni duplicado.
-- ---------------------------------------------------------------------------
do $$
declare
  v_choques int;
  v_ok      int;
begin
  select count(*) into v_choques from (
    select round_id, time_block_id, court_id
    from matches group by round_id, time_block_id, court_id having count(*) > 1
  ) t;
  if v_choques > 0 then
    raise exception 'Hay % choque(s) de cancha y horario tras el intercambio.', v_choques;
  end if;

  select count(*) into v_ok
  from matches m
  join rounds r on r.id = m.round_id
  join time_blocks tb on tb.id = m.time_block_id
  join courts c on c.id = m.court_id
  where r.round_number = 2
    and ((m.category_code = 'SUMA13_FEM' and tb.label = '21:00' and c.name = 'Cancha 7')
      or (m.category_code = 'VAR_5'      and tb.label = '19:45' and c.name = 'Cancha 5'));

  if v_ok <> 2 then
    raise exception 'El intercambio no quedó como se esperaba (% de 2 partidos en su sitio).', v_ok;
  end if;

  raise notice 'Verificado: 0 choques y los 2 partidos en su horario nuevo.';
end $$;
