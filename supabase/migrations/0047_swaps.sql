-- 0047_swaps.sql
-- Regla establecida por la organizadora (2026-08-24): cada equipo tiene
-- 4 SWAPS por temporada (cambiar a un jugador ya alineado, previo al juego,
-- sobre rol publicado) y 3 DOBLETEOS (un jugador repite juego en la jornada),
-- con dos excepciones al conteo de dobleteos: jugadores de 3a Femenil / 4a
-- Varonil (no hay gente suficiente) y cuando el que dobletea juega una
-- categoría superior a la suya.
--
-- QUÉ HACE ESTA MIGRACIÓN:
--   1. El tope de cambios contados pasa de 5 a 4 y se renombra a "swaps".
--   2. RPC register_swap: la capitana (o el organizador) registra un swap —
--      actualiza la alineación publicada Y lo cuenta, en una transacción.
--   3. Vista team_swaps: transparencia — capitanas y organizadores ven los
--      swaps de TODOS los equipos (quién entró por quién y en qué jornada).
--   4. Backfill de 6 swaps ya ocurridos y nunca registrados (dictados por la
--      organizadora, direcciones verificadas contra las alineaciones reales).
--
-- Los DOBLETEOS no se almacenan: se DERIVAN de las alineaciones publicadas
-- (CLAUDE.md §3.4) — la lógica y sus excepciones viven en el cliente con tests
-- (features/lineups/dobleteos.ts) porque son presentación de datos públicos.

-- ---------------------------------------------------------------------------
-- 1. Tope: 4 swaps. Solo bloquea inserciones que cuentan y solo a capitanas
--    (el organizador es autoridad final: registra igual, pero no se bloquea).
-- ---------------------------------------------------------------------------
create or replace function enforce_change_limit()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  used int;
  season uuid;
begin
  if not new.counts_against_limit then
    return new;
  end if;

  if is_organizer() then
    return new;
  end if;

  select s.id into season
  from rounds r join seasons s on s.id = r.season_id
  where r.id = new.round_id;

  select count(*) into used
  from lineup_change_logs lcl
  join rounds r on r.id = lcl.round_id
  where lcl.team_id = new.team_id
    and lcl.counts_against_limit
    and r.season_id = season;

  if used >= 4 then
    raise exception
      'Límite alcanzado: el equipo ya usó sus 4 swaps de la temporada.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. El candado del sábado deja pasar el swap registrado.
--    Idéntica a 0035 salvo la bandera transaccional liga.allow_swap, que SOLO
--    fija register_swap después de validar todo y cobrar el swap. Sin esto, la
--    capitana no podría registrar: el trigger la bloquearía por fecha.
-- ---------------------------------------------------------------------------
create or replace function enforce_entry_lock()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_deadline timestamptz;
begin
  if is_organizer() then
    return new;
  end if;

  if coalesce(current_setting('liga.allow_swap', true), '') = '1' then
    return new;
  end if;

  select lineup_deadline(r.round_date) into v_deadline
  from lineups l
  join team_matchups tm on tm.id = l.team_matchup_id
  join rounds r on r.id = tm.round_id
  where l.id = new.lineup_id;

  if v_deadline is not null and now() >= v_deadline then
    raise exception
      'Alineación bloqueada: el límite fue el sábado 07:00 antes de la jornada.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. register_swap: quién sale, quién entra, en qué jornada.
--
--    Orden deliberado: el LOG va primero (el trigger del tope puede rechazar y
--    entonces no se toca la alineación); la actualización de la entrada va
--    después, con la bandera puesta. Todo en la misma transacción: o pasa
--    entero o no pasa nada.
-- ---------------------------------------------------------------------------
create or replace function register_swap(
  p_round_id uuid,
  p_player_out uuid,
  p_player_in uuid,
  p_team_id uuid default null,        -- solo lo usa el organizador
  p_category_code text default null   -- solo si el que sale dobletea esa jornada
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team    uuid;
  v_out     players%rowtype;
  v_in      players%rowtype;
  v_lineup  lineups%rowtype;
  v_entry   lineup_entries%rowtype;
  v_multi   int;
  v_new1    uuid;
  v_new2    uuid;
  v_season  uuid;
  v_used    int;
begin
  if is_organizer() then
    v_team := coalesce(p_team_id, captain_team_id());
  else
    v_team := captain_team_id();
  end if;
  if v_team is null then
    raise exception 'Solo la capitana del equipo (o el organizador) puede registrar un swap.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_team::text, 0));

  select * into v_out from players where id = p_player_out;
  select * into v_in  from players where id = p_player_in;
  if v_out.id is null or v_in.id is null then
    raise exception 'Jugador no encontrado.';
  end if;
  if p_player_in = p_player_out then
    raise exception 'El que entra y el que sale son la misma persona.';
  end if;
  if v_in.team_id is distinct from v_team then
    raise exception '% no pertenece al equipo.', v_in.full_name;
  end if;
  if not v_in.is_active then
    raise exception '% está inactivo.', v_in.full_name;
  end if;
  -- Mismo género: el hueco de la categoría lo exige (en mixtas y sumas, cambiar
  -- de género rompería la composición de la pareja).
  if v_in.gender is distinct from v_out.gender then
    raise exception 'El swap debe ser entre jugadores del mismo género.';
  end if;

  select l.* into v_lineup
  from lineups l
  join team_matchups tm on tm.id = l.team_matchup_id
  where tm.round_id = p_round_id and l.team_id = v_team;
  if v_lineup.id is null then
    raise exception 'El equipo no tiene alineación en esa jornada.';
  end if;
  if v_lineup.locked_at is null then
    raise exception 'El rol de esa jornada aún no se publica: edita la alineación normal (no gasta swap).';
  end if;

  if p_category_code is not null then
    select le.* into v_entry from lineup_entries le
    where le.lineup_id = v_lineup.id
      and le.category_code = p_category_code
      and (le.player_1_id = p_player_out or le.player_2_id = p_player_out);
  else
    select count(*) into v_multi from lineup_entries le
    where le.lineup_id = v_lineup.id
      and (le.player_1_id = p_player_out or le.player_2_id = p_player_out);
    if v_multi > 1 then
      raise exception '% está alineado en más de una categoría esta jornada: especifica en cuál sale.', v_out.full_name;
    end if;
    select le.* into v_entry from lineup_entries le
    where le.lineup_id = v_lineup.id
      and (le.player_1_id = p_player_out or le.player_2_id = p_player_out);
  end if;

  if v_entry.id is null then
    raise exception '% no está alineado en esa jornada.', v_out.full_name;
  end if;
  if v_entry.player_1_id = p_player_in or v_entry.player_2_id = p_player_in then
    raise exception '% ya está en ese partido.', v_in.full_name;
  end if;

  v_new1 := case when v_entry.player_1_id = p_player_out then p_player_in else v_entry.player_1_id end;
  v_new2 := case when v_entry.player_2_id = p_player_out then p_player_in else v_entry.player_2_id end;

  insert into lineup_change_logs
    (lineup_id, team_id, round_id, match_id, changed_by, before_data, after_data, counts_against_limit)
  values (
    v_lineup.id, v_team, p_round_id, v_entry.match_id, auth.uid(),
    jsonb_build_object('player_1_id', v_entry.player_1_id, 'player_2_id', v_entry.player_2_id),
    jsonb_build_object('player_1_id', v_new1, 'player_2_id', v_new2),
    true
  );

  perform set_config('liga.allow_swap', '1', true);
  update lineup_entries set player_1_id = v_new1, player_2_id = v_new2 where id = v_entry.id;
  perform set_config('liga.allow_swap', '', true);

  select s.id into v_season from rounds r join seasons s on s.id = r.season_id where r.id = p_round_id;
  select count(*) into v_used
  from lineup_change_logs lcl join rounds r on r.id = lcl.round_id
  where lcl.team_id = v_team and lcl.counts_against_limit and r.season_id = v_season;

  return jsonb_build_object('ok', true, 'swaps_usados', v_used, 'limite', 4);
end;
$$;

revoke execute on function register_swap(uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function register_swap(uuid, uuid, uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Vista team_swaps: los swaps contados de todos los equipos, con quién salió
--    y quién entró (derivado del diff before/after del log). Un log que cambió
--    a los DOS jugadores de la pareja emite dos filas; el CONTEO de swaps es
--    por log (count(distinct id) en el cliente), igual que cuenta el trigger.
--
--    DEFINER a propósito: la RLS de lineup_change_logs solo deja a cada capitana
--    leer lo suyo, y la transparencia pedida es que todas vean a todos. Lectura
--    solo para authenticated: es información de gestión, no de la web pública.
-- ---------------------------------------------------------------------------
create or replace view team_swaps as
select
  lcl.id,
  lcl.team_id,
  r.round_number,
  r.season_id,
  m.category_code,
  lcl.created_at,
  z.player_out_id,
  z.player_in_id
from lineup_change_logs lcl
join rounds r on r.id = lcl.round_id
left join matches m on m.id = lcl.match_id
cross join lateral (
  select
    (select array(
       select v from (
         select (lcl.before_data->>'player_1_id')::uuid as v
         union
         select (lcl.before_data->>'player_2_id')::uuid
         except
         select x from (
           select (lcl.after_data->>'player_1_id')::uuid as x
           union
           select (lcl.after_data->>'player_2_id')::uuid
         ) a
       ) q where v is not null
     )) as outs,
    (select array(
       select v from (
         select (lcl.after_data->>'player_1_id')::uuid as v
         union
         select (lcl.after_data->>'player_2_id')::uuid
         except
         select x from (
           select (lcl.before_data->>'player_1_id')::uuid as x
           union
           select (lcl.before_data->>'player_2_id')::uuid
         ) b
       ) q where v is not null
     )) as ins
) arrs
cross join lateral unnest(arrs.outs, arrs.ins) as z(player_out_id, player_in_id)
where lcl.counts_against_limit;

-- Regla 0041: toda vista nueva nace con TODOS los privilegios para anon y
-- authenticated (default privileges); se cierra y se abre solo lo pedido.
revoke all on team_swaps from public, anon, authenticated;
grant select on team_swaps to authenticated;

-- ---------------------------------------------------------------------------
-- 5. BACKFILL: los 6 swaps que ya ocurrieron y no se registraron.
--    Dictados por la organizadora; dirección verificada contra las alineaciones
--    reales (quién está alineado hoy es el que SALE). El de J4 fue en MIX_A
--    (confirmado por ella: Huerta conservó su 5a Varonil).
--
--    Cada uno: corrige la entrada de alineación (el que jugó de verdad) e
--    inserta el log contado. Idempotente: si la entrada ya tiene al que entra,
--    se salta. El trigger del tope corre con estos INSERT (auth null → no
--    organizador) y no dispara: quedan Passio 3, Padel Center 2, Peak 1.
--
--    OJO: J1, J3 y J4 ya tienen resultado oficial → cambia la atribución de
--    estadísticas y rating de esos partidos. RECALCULAR el rating después
--    (Organización → Rating → Recalcular).
-- ---------------------------------------------------------------------------
do $$
declare
  s record;
  v_out_id uuid;
  v_in_id  uuid;
  v_entry  lineup_entries%rowtype;
  v_lineup lineups%rowtype;
  v_round  uuid;
  v_new1   uuid;
  v_new2   uuid;
  v_hechos int := 0;
begin
  perform set_config('liga.allow_swap', '1', true);

  for s in
    select * from (values
      (1, 'VAR_6',      'Dizan Mendoza',    'Raul Fierro'),
      (3, 'FEM_6',      'Tana Otamendi',    'Celeste Zapata'),
      (3, 'FEM_6',      'Leticia Félix',    'Priscilla Lozano'),
      (3, 'FEM_4',      'Adriana Haro',     'Anilú Gaytán'),
      (4, 'MIX_A',      'Alejandro Huerta', 'Andre Luna'),
      (5, 'SUMA7_FEM',  'Sofía Payán',      'Zayra Azaeta')
    ) as t(jornada, cat, sale, entra)
  loop
    select id into v_out_id from players where full_name = s.sale;
    select id into v_in_id  from players where full_name = s.entra;
    if v_out_id is null or v_in_id is null then
      raise exception 'Backfill: no se encontró a "%" o a "%" en players.', s.sale, s.entra;
    end if;

    select r.id into v_round from rounds r where r.round_number = s.jornada;

    -- La entrada que contiene al que SALE, en esa jornada y categoría.
    select le.* into v_entry
    from lineup_entries le
    join lineups l on l.id = le.lineup_id
    join team_matchups tm on tm.id = l.team_matchup_id
    where tm.round_id = v_round
      and le.category_code = s.cat
      and (le.player_1_id = v_out_id or le.player_2_id = v_out_id);

    if v_entry.id is null then
      -- ¿Ya aplicado (la entrada tiene al que ENTRA)? Entonces solo avisar.
      if exists (
        select 1 from lineup_entries le
        join lineups l on l.id = le.lineup_id
        join team_matchups tm on tm.id = l.team_matchup_id
        where tm.round_id = v_round and le.category_code = s.cat
          and (le.player_1_id = v_in_id or le.player_2_id = v_in_id)
      ) then
        raise notice 'J% %: % ya estaba en la alineación — swap previamente aplicado, no se toca.', s.jornada, s.cat, s.entra;
        continue;
      end if;
      raise exception 'Backfill J% %: no se encontró a % alineado.', s.jornada, s.cat, s.sale;
    end if;

    select l.* into v_lineup from lineups l where l.id = v_entry.lineup_id;

    -- El que entra debe ser del MISMO equipo que la alineación.
    if (select team_id from players where id = v_in_id) is distinct from v_lineup.team_id then
      raise exception 'Backfill J% %: % no es del mismo equipo que la alineación.', s.jornada, s.cat, s.entra;
    end if;

    v_new1 := case when v_entry.player_1_id = v_out_id then v_in_id else v_entry.player_1_id end;
    v_new2 := case when v_entry.player_2_id = v_out_id then v_in_id else v_entry.player_2_id end;

    -- Log contado (idempotente: no duplicar si ya existe uno idéntico).
    if not exists (
      select 1 from lineup_change_logs
      where lineup_id = v_lineup.id and match_id = v_entry.match_id
        and counts_against_limit
        and after_data = jsonb_build_object('player_1_id', v_new1, 'player_2_id', v_new2)
    ) then
      insert into lineup_change_logs
        (lineup_id, team_id, round_id, match_id, changed_by, before_data, after_data, counts_against_limit)
      values (
        v_lineup.id, v_lineup.team_id, v_round, v_entry.match_id, null,
        jsonb_build_object('player_1_id', v_entry.player_1_id, 'player_2_id', v_entry.player_2_id),
        jsonb_build_object('player_1_id', v_new1, 'player_2_id', v_new2),
        true
      );
    end if;

    update lineup_entries set player_1_id = v_new1, player_2_id = v_new2 where id = v_entry.id;
    v_hechos := v_hechos + 1;
  end loop;

  raise notice 'Backfill de swaps: % aplicados.', v_hechos;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Comprobación final: conteo de swaps por equipo tal como lo verá la app.
--    Esperado tras el backfill: Passio 3 · Padel Center 2 · Peak 1 · resto 0.
-- ---------------------------------------------------------------------------
do $$
declare
  v_passio int;
  v_pc     int;
  v_peak   int;
begin
  select count(distinct ts.id) into v_passio
  from team_swaps ts join teams t on t.id = ts.team_id where t.name ilike '%passio%';
  select count(distinct ts.id) into v_pc
  from team_swaps ts join teams t on t.id = ts.team_id where t.name ilike '%center%';
  select count(distinct ts.id) into v_peak
  from team_swaps ts join teams t on t.id = ts.team_id where t.name ilike '%peak%';

  if v_passio <> 3 or v_pc <> 2 or v_peak <> 1 then
    raise exception 'Conteo inesperado tras el backfill: Passio=% (esp. 3), Padel Center=% (esp. 2), Peak=% (esp. 1)',
      v_passio, v_pc, v_peak;
  end if;

  raise notice 'Swaps contados: Passio 3 · Padel Center 2 · Peak 1. Recuerda RECALCULAR el rating.';
end $$;
