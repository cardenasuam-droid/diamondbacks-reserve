-- 0044_integrity_belts.sql
-- Cinturones de integridad. [Fase 0.4 del diagnóstico 2026-07-20]
--
-- Tres redes que hoy no existen y cuyo coste de ponerlas es mínimo AHORA:
--   1. match_results no tiene un solo CHECK. Se blinda con 0 filas (verificado
--      hoy) — cualquier otro día habría que validar datos existentes.
--   2. reset_draft desasigna ~162 jugadores de sus equipos con un clic y borra
--      draft_picks, que es la fuente de esas asignaciones. En temporada eso es
--      irreversible. El botón sigue visible en la UI del draft.
--   3. apply_rating_events no toma lock: dos capturas casi simultáneas pueden
--      pisarse (lost update) y dejar fuera del rating el último resultado.

-- ---------------------------------------------------------------------------
-- 1. match_results: coherencia interna del marcador
--
-- Rango 0..7 por set (ataja el dedazo "65"), no combinación legal: el
-- organizador debe poder capturar un retiro (3-1) o un caso atípico. La regla
-- estricta de pádel solo se aplica al reporte de capitanas (is_valid_padel_set,
-- 0043).
-- ---------------------------------------------------------------------------
alter table match_results drop constraint if exists chk_result_set_range;
alter table match_results add constraint chk_result_set_range check (
  (set1_team_a is null or set1_team_a between 0 and 7) and
  (set1_team_b is null or set1_team_b between 0 and 7) and
  (set2_team_a is null or set2_team_a between 0 and 7) and
  (set2_team_b is null or set2_team_b between 0 and 7) and
  (set3_team_a is null or set3_team_a between 0 and 7) and
  (set3_team_b is null or set3_team_b between 0 and 7)
);

-- Un set se captura entero o no se captura: nunca un solo lado. Un set a medias
-- se persistía en silencio y las vistas lo ignoraban, así que el marcador
-- público quedaba distinto del capturado.
alter table match_results drop constraint if exists chk_result_sets_complete;
alter table match_results add constraint chk_result_sets_complete check (
  (set1_team_a is null) = (set1_team_b is null) and
  (set2_team_a is null) = (set2_team_b is null) and
  (set3_team_a is null) = (set3_team_b is null)
);

-- El walkover y su equipo ausente van SIEMPRE juntos. Sin esto, un walkover sin
-- walkover_team_id deja a per_team_match (0003) sin saber a quién dar los 3
-- puntos, y un walkover_team_id colgando en un resultado normal es basura que
-- puede activarse si alguien marca is_walkover después.
alter table match_results drop constraint if exists chk_walkover_pair;
alter table match_results add constraint chk_walkover_pair check (
  (is_walkover and walkover_team_id is not null) or
  (not is_walkover and walkover_team_id is null)
);

-- ---------------------------------------------------------------------------
-- 2. match_results: coherencia con el enfrentamiento
--
-- winner_team_id y walkover_team_id deben ser uno de los DOS equipos que juegan
-- ese partido. Un CHECK no puede consultar otras tablas; va como trigger.
-- Esto ataja el peor error silencioso posible: un id de equipo ajeno haría que
-- el partido no sume a nadie en la tabla y que el rating quede descuadrado.
-- ---------------------------------------------------------------------------
create or replace function enforce_result_teams()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_a uuid;
  v_b uuid;
begin
  select tm.team_a_id, tm.team_b_id into v_a, v_b
  from matches m join team_matchups tm on tm.id = m.team_matchup_id
  where m.id = new.match_id;

  if not found then
    raise exception 'El partido % no existe.', new.match_id;
  end if;

  if new.winner_team_id is not null and new.winner_team_id not in (v_a, v_b) then
    raise exception 'El ganador no es uno de los dos equipos de este partido.';
  end if;

  if new.walkover_team_id is not null and new.walkover_team_id not in (v_a, v_b) then
    raise exception 'El equipo ausente no es uno de los dos equipos de este partido.';
  end if;

  -- En un walkover, quien gana es forzosamente el que SÍ se presentó.
  if new.is_walkover and new.winner_team_id is not null
     and new.winner_team_id = new.walkover_team_id then
    raise exception 'En un walkover el ganador no puede ser el equipo ausente.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_result_teams on match_results;
create trigger trg_result_teams
  before insert or update on match_results
  for each row execute function enforce_result_teams();

-- ---------------------------------------------------------------------------
-- 3. reset_draft: seguro contra el clic catastrófico
--
-- Idéntica a la de 0028 salvo la guarda inicial. Si la temporada ya arrancó
-- (hay resultados o alineaciones publicadas), reiniciar el draft desasignaría a
-- todos los jugadores de sus equipos y dejaría el calendario huérfano. Antes de
-- la primera jornada sigue permitido, que es cuando el botón tiene sentido.
-- ---------------------------------------------------------------------------
create or replace function reset_draft(p_draft_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  d drafts%rowtype;
  v_res int;
  v_pub int;
begin
  if not is_organizer() then raise exception 'Solo el organizador puede reiniciar el draft.'; end if;
  select * into d from drafts where id = p_draft_id for update;
  if not found then raise exception 'Draft no encontrado.'; end if;

  select count(*) into v_res
  from match_results mr
  join matches m on m.id = mr.match_id
  join rounds r on r.id = m.round_id
  where r.season_id = d.season_id;

  select count(*) into v_pub
  from lineups l
  join team_matchups tm on tm.id = l.team_matchup_id
  join rounds r on r.id = tm.round_id
  where r.season_id = d.season_id and l.locked_at is not null;

  if v_res > 0 or v_pub > 0 then
    raise exception
      'La temporada ya empezó (% resultado(s), % alineación(es) publicada(s)): reiniciar el draft desasignaría a todos los jugadores de sus equipos.',
      v_res, v_pub;
  end if;

  update players pl set team_id = null
  from draft_picks dp
  where dp.draft_id = p_draft_id and dp.player_id = pl.id;

  delete from draft_picks where draft_id = p_draft_id;
  delete from draft_category_orders where draft_id = p_draft_id;

  update drafts
  set status = 'setup', is_drawing = false, current_category_code = null,
      pick_deadline = null, paused_remaining_ms = null
  where id = p_draft_id;
end $$;

-- ---------------------------------------------------------------------------
-- 4. apply_rating_events: lock por temporada
--
-- Idéntica a la de 0040 salvo el advisory lock. Sin él, dos recálculos
-- concurrentes (dos resultados guardados casi a la vez, o dos dispositivos)
-- pueden pisarse: el segundo borra los eventos del primero y escribe los suyos,
-- calculados sobre un estado que ya cambió. El lock es por temporada y se
-- libera al terminar la transacción.
-- ---------------------------------------------------------------------------
create or replace function apply_rating_events(
  p_season_id uuid,
  p_events    jsonb,
  p_finals    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_events   int;
  v_players  int;
  v_intrusos int;
begin
  if not is_organizer() then
    raise exception 'Solo el organizador puede recalcular el rating.';
  end if;

  if p_season_id is null then
    raise exception 'Falta la temporada.';
  end if;

  -- Serializa los recálculos de la MISMA temporada. Dos capturas simultáneas se
  -- ponen en fila en vez de pisarse.
  perform pg_advisory_xact_lock(hashtextextended(p_season_id::text, 0));

  -- Un lote que mezclara temporadas borraría los eventos de una y escribiría los
  -- de otra. Se rechaza entero antes de tocar nada.
  select count(*) into v_intrusos
    from jsonb_to_recordset(p_events) as e(season_id uuid)
   where e.season_id is distinct from p_season_id;
  if v_intrusos > 0 then
    raise exception 'El lote trae % eventos de otra temporada.', v_intrusos;
  end if;

  delete from player_rating_events where season_id = p_season_id;

  insert into player_rating_events (
    season_id, round_id, match_id, player_id, partner_id, team_id, opponent_team_id,
    category_code, sequence, rating_before, rating_after, delta, pair_rating,
    opponent_pair_rating, expected, mov, won, games_for, games_against
  )
  select e.season_id, e.round_id, e.match_id, e.player_id, e.partner_id, e.team_id,
         e.opponent_team_id, e.category_code, e.sequence, e.rating_before, e.rating_after,
         e.delta, e.pair_rating, e.opponent_pair_rating, e.expected, e.mov, e.won,
         e.games_for, e.games_against
    from jsonb_to_recordset(p_events) as e(
      season_id            uuid,
      round_id             uuid,
      match_id             uuid,
      player_id            uuid,
      partner_id           uuid,
      team_id              uuid,
      opponent_team_id     uuid,
      category_code        text,
      sequence             int,
      rating_before        numeric,
      rating_after         numeric,
      delta                numeric,
      pair_rating          numeric,
      opponent_pair_rating numeric,
      expected             numeric,
      mov                  numeric,
      won                  boolean,
      games_for            int,
      games_against        int
    );
  get diagnostics v_events = row_count;

  update players p
     set rating         = f.rating,
         rating_matches = f.matches
    from jsonb_to_recordset(p_finals) as f(player_id uuid, rating numeric, matches int)
   where p.id = f.player_id
     and p.season_id = p_season_id
     and (p.rating is distinct from f.rating or p.rating_matches is distinct from f.matches);
  get diagnostics v_players = row_count;

  return jsonb_build_object('ok', true, 'events', v_events, 'players', v_players);
end
$$;

grant execute on function apply_rating_events(uuid, jsonb, jsonb) to authenticated;
grant execute on function reset_draft(uuid) to authenticated;
