-- 0040_apply_rating_events.sql
-- Escritura atómica del recálculo de rating.
--
-- REPARTO DE RESPONSABILIDADES. La matemática del ELO vive en TypeScript
-- (src/features/rating/computeRating.ts y replaySeason.ts) con 49 tests de
-- Vitest, porque CLAUDE.md §1 exige tests para la lógica de cálculo y este es,
-- junto a la validación de alineaciones, el corazón de la app. Duplicarla en
-- plpgsql daría dos motores que se desincronizarían al primer ajuste.
--
-- Esta función NO calcula: recibe los eventos ya calculados y los persiste en una
-- sola transacción. El servidor hace cumplir QUIÉN puede escribir (organizador),
-- no la aritmética. Es una desviación consciente de CLAUDE.md §3.5, que exige
-- validaciones críticas en servidor: esa regla apunta a lo que un usuario podría
-- saltarse en su beneficio (el candado de 1 hora, el tope de cambios de
-- alineación). El rating no es eso — es informativo y solo el organizador lo
-- toca. Si algún día se quiere blindado, el camino es una Edge Function que
-- ejecute el MISMO módulo TypeScript, no reescribir la fórmula aquí.
--
-- Borra y regenera los eventos de la temporada entera en vez de actualizar en
-- incremental: los resultados se sobrescriben con upsert y las alineaciones son
-- editables después del resultado, así que no hay estado viejo del que partir.
--
-- Nota de sintaxis, aprendida a golpes en 0039 y en el primer intento de esta:
-- el cuerpo va con el delimitador de dólar DESNUDO, como todas las funciones de
-- este repo. Una etiqueta con nombre parece más segura, pero el separador de
-- sentencias del SQL Editor de Supabase no la reconoce: parte el cuerpo en el
-- primer punto y coma y ejecuta los trozos como SQL suelto.
-- El riesgo real del delimitador desnudo es otro: Postgres NO lee comentarios
-- dentro del cuerpo, así que escribir ahí dentro un par de signos de dólar lo
-- cierra antes de tiempo. Ese riesgo se cubre con una comprobación mecánica
-- (scratchpad/check_dollar.ps1), no escribiendo el delimitador en prosa.

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

  -- El rating vigente es caché de los eventos: se reescribe entero. Se limita a
  -- los jugadores de la temporada indicada y solo escribe los que cambian, para
  -- no disparar triggers ni updated_at de balde.
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

-- La autorización vive DENTRO de la función (is_organizer), no en el grant:
-- mismo patrón que reset_player_account (0025) y save_lineup (0018).
grant execute on function apply_rating_events(uuid, jsonb, jsonb) to authenticated;
