-- 0043_captain_report_result.sql
-- Las capitanas REPORTAN resultados; el organizador VALIDA.
--
-- Reactiva el flujo que el esquema anticipó desde 0001 y nunca se construyó:
-- match_results.reported_by y el estado 'reported' existían muertos. La capitana
-- de cualquiera de los dos equipos del enfrentamiento captura el marcador de un
-- partido y queda en estado 'reported': VISIBLE para ella y para el organizador,
-- pero INERTE — las vistas de tabla/ranking (0003) y el motor de rating solo
-- cuentan validated/walkover/corrected, así que un reporte no mueve nada hasta
-- que el organizador lo valida desde su panel (abrir el partido pre-llenado y
-- guardar). Mientras está en 'reported' puede corregirse (misma capitana, la
-- rival, o el organizador pisándolo al validar).
--
-- SEGURIDAD (CLAUDE.md §3.5): es la primera escritura de capitanas sobre
-- match_results, así que TODA la validación vive aquí, no en React:
--   - solo capitana/co-capitana de un equipo del enfrentamiento;
--   - no se reportan partidos programados a futuro;
--   - jamás se pisa un resultado oficial (guard atómico en el propio UPSERT,
--     sin ventana entre comprobar y escribir: si el organizador valida en medio,
--     el reporte rebota);
--   - marcador válido de pádel set a set (6-0..6-4, 7-5, 7-6; el tercer set es
--     set completo, reglamento §"Todos los partidos se juegan a 3 sets") y
--     ganador derivado EN EL SERVIDOR de los sets. Un retiro a media partida no
--     pasa esta validación a propósito: eso lo captura el organizador, que no
--     tiene esta restricción.
-- Los walkovers quedan FUERA del reporte de capitanas: son administrativos y
-- punitivos, los declara solo el organizador.
--
-- SECURITY DEFINER: la RLS de match_results no cambia (escritura directa sigue
-- siendo solo del organizador); esta función es la única puerta de la capitana.

-- Set válido de pádel: 6 con margen >= 2, o 7-5 / 7-6.
create or replace function is_valid_padel_set(a int, b int)
returns boolean language sql immutable as $$
  select (a = 6 and b between 0 and 4)
      or (a = 7 and (b = 5 or b = 6))
      or (b = 6 and a between 0 and 4)
      or (b = 7 and (a = 5 or a = 6));
$$;

create or replace function report_match_result(
  p_match_id uuid,
  p_s1a int, p_s1b int,
  p_s2a int, p_s2b int,
  p_s3a int default null, p_s3b int default null
) returns void
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_team    uuid;
  v_match   record;
  v_sets_a  int := 0;
  v_sets_b  int := 0;
  v_winner  uuid;
  v_rows    int;
begin
  v_team := captain_team_id();
  if v_team is null then
    raise exception 'Solo la capitana o co-capitana de un equipo puede reportar resultados.';
  end if;

  select m.id, m.scheduled_at, tm.team_a_id, tm.team_b_id
    into v_match
    from matches m
    join team_matchups tm on tm.id = m.team_matchup_id
   where m.id = p_match_id;
  if not found then
    raise exception 'El partido no existe.';
  end if;

  if v_team <> v_match.team_a_id and v_team <> v_match.team_b_id then
    raise exception 'Tu equipo no juega este partido.';
  end if;

  -- Sin reportes anticipados: el partido debe ser de hoy o del pasado.
  if v_match.scheduled_at is not null
     and (v_match.scheduled_at at time zone 'America/Mexico_City')::date > current_date then
    raise exception 'Este partido aún no se juega.';
  end if;

  -- Marcador: sets 1 y 2 obligatorios y válidos; el 3º completo o ausente.
  if p_s1a is null or p_s1b is null or p_s2a is null or p_s2b is null then
    raise exception 'Captura completos los sets 1 y 2.';
  end if;
  if not is_valid_padel_set(p_s1a, p_s1b) or not is_valid_padel_set(p_s2a, p_s2b) then
    raise exception 'Marcador no válido (sets: 6-0 a 6-4, 7-5 o 7-6). Si hubo retiro, avisa al organizador.';
  end if;
  if (p_s3a is null) <> (p_s3b is null) then
    raise exception 'El tercer set está incompleto.';
  end if;
  if p_s3a is not null and not is_valid_padel_set(p_s3a, p_s3b) then
    raise exception 'Marcador no válido en el tercer set (6-0 a 6-4, 7-5 o 7-6).';
  end if;

  -- Ganador derivado de los sets, EN EL SERVIDOR (winner_team_id jamás del cliente).
  v_sets_a := (p_s1a > p_s1b)::int + (p_s2a > p_s2b)::int + coalesce((p_s3a > p_s3b)::int, 0);
  v_sets_b := (p_s1b > p_s1a)::int + (p_s2b > p_s2a)::int + coalesce((p_s3b > p_s3a)::int, 0);

  if v_sets_a = 1 and v_sets_b = 1 and p_s3a is null then
    raise exception 'Empate 1-1 en sets: falta el tercer set.';
  end if;
  -- Si los DOS primeros sets los ganó el mismo equipo, el partido terminó ahí:
  -- un tercer set es imposible aunque el marcador tecleado fuera "legal" set a
  -- set (cubre también la secuencia A,A,B que un conteo 2-1 dejaría pasar).
  if (p_s1a > p_s1b) = (p_s2a > p_s2b) and p_s3a is not null then
    raise exception 'El partido se decidió en dos sets: no captures el tercero.';
  end if;

  v_winner := case when v_sets_a > v_sets_b then v_match.team_a_id else v_match.team_b_id end;

  -- Guard atómico DENTRO del upsert: el WHERE de la rama update impide pisar un
  -- resultado oficial aunque el organizador valide entre la lectura y esta
  -- escritura. Sin ventana TOCTOU.
  insert into match_results (
    match_id, status, reported_by,
    is_walkover, walkover_team_id, winner_team_id,
    set1_team_a, set1_team_b, set2_team_a, set2_team_b, set3_team_a, set3_team_b,
    validated_by, validated_at
  ) values (
    p_match_id, 'reported', auth.uid(),
    false, null, v_winner,
    p_s1a, p_s1b, p_s2a, p_s2b, p_s3a, p_s3b,
    null, null
  )
  on conflict (match_id) do update set
    status = 'reported',
    reported_by = auth.uid(),
    is_walkover = false,
    walkover_team_id = null,
    winner_team_id = excluded.winner_team_id,
    set1_team_a = excluded.set1_team_a, set1_team_b = excluded.set1_team_b,
    set2_team_a = excluded.set2_team_a, set2_team_b = excluded.set2_team_b,
    set3_team_a = excluded.set3_team_a, set3_team_b = excluded.set3_team_b
  where match_results.status in ('pending_report', 'reported');

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Este resultado ya fue validado por el organizador; para corregirlo, contáctalo.';
  end if;
end;
$$;

-- EXECUTE solo con sesión; anon fuera (higiene del diagnóstico: los default
-- privileges regalan EXECUTE a anon en toda función nueva). La autorización
-- real vive dentro (captain_team_id), como en save_lineup y 0025.
revoke execute on function report_match_result(uuid, int, int, int, int, int, int) from public, anon;
revoke execute on function is_valid_padel_set(int, int) from public, anon;
grant execute on function report_match_result(uuid, int, int, int, int, int, int) to authenticated;
grant execute on function is_valid_padel_set(int, int) to authenticated;
