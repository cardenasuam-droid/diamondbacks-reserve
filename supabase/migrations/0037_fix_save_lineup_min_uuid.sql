-- 0037_fix_save_lineup_min_uuid.sql
-- HOTFIX: guardar/enviar alineación fallaba con "function min(uuid) does not exist".
--
-- Causa: save_lineup (0018) obtenía la jornada con `select min(m.round_id)` sobre
-- matches, pero round_id es UUID y Postgres NO tiene un agregado min() para uuid.
-- Rompía TODO guardado de alineación (borrador y envío) y también el autogenerado
-- del cierre de jornada (que llama a save_lineup).
--
-- Arreglo: todas las filas de un enfrentamiento comparten round_id, y team_matchups
-- ya lo tiene, así que se lee directo de ahí (sin agregado). Redefine save_lineup
-- idéntica salvo esa línea. 100% del lado servidor: aplicar este SQL arregla la app
-- en vivo sin necesidad de redeploy del cliente.

create or replace function save_lineup(
  p_team_matchup_id uuid,
  p_team_id uuid,          -- solo lo usa el organizador; para el capitán se ignora
  p_submit boolean,
  p_entries jsonb          -- [{category_code, match_id, player_1_id, player_2_id}]
) returns uuid
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_team    uuid;
  v_round   uuid;
  v_lineup  lineups%rowtype;
  v_prev    lineup_status;
  v_now     timestamptz := now();
  e         jsonb;
  v_cat     text;
  v_match   uuid;
  v_p1      uuid;
  v_p2      uuid;
  v_pp1     uuid;
  v_pp2     uuid;
begin
  -- Equipo de forma segura (nunca se confía del cliente para el capitán).
  if is_organizer() then
    v_team := p_team_id;
  else
    v_team := captain_team_id();
    if v_team is null then
      raise exception 'Solo el capitán de un equipo puede guardar alineaciones.';
    end if;
  end if;
  if v_team is null then
    raise exception 'No se pudo determinar el equipo de la alineación.';
  end if;

  -- Serializa por equipo: evita que dos guardados concurrentes rebasen el tope de 5.
  perform pg_advisory_xact_lock(hashtextextended(v_team::text, 0));

  -- Jornada del enfrentamiento (todas sus filas comparten round_id). Antes se usaba
  -- min(m.round_id) sobre matches → error: min(uuid) no existe. Se lee de team_matchups.
  select tm.round_id into v_round
  from team_matchups tm where tm.id = p_team_matchup_id;

  select * into v_lineup
  from lineups
  where team_matchup_id = p_team_matchup_id and team_id = v_team;

  if not found then
    insert into lineups (team_matchup_id, team_id, submitted_by, status, submitted_at)
    values (
      p_team_matchup_id, v_team, auth.uid(),
      case when p_submit then 'submitted'::lineup_status else 'draft'::lineup_status end,
      case when p_submit then v_now else null end
    )
    returning * into v_lineup;
  else
    v_prev := v_lineup.status;

    -- Modificación tras el primer envío: un log por categoría con pareja distinta.
    -- El trigger enforce_change_limit hace cumplir el tope de 5 (lanza si se supera).
    if v_prev <> 'draft' then
      for e in select * from jsonb_array_elements(p_entries) loop
        v_cat   := e->>'category_code';
        v_match := nullif(e->>'match_id', '')::uuid;
        v_p1    := nullif(e->>'player_1_id', '')::uuid;
        v_p2    := nullif(e->>'player_2_id', '')::uuid;

        select player_1_id, player_2_id into v_pp1, v_pp2
        from lineup_entries
        where lineup_id = v_lineup.id and category_code = v_cat;

        if pair_key(v_p1, v_p2) is distinct from pair_key(v_pp1, v_pp2) then
          insert into lineup_change_logs
            (lineup_id, team_id, round_id, match_id, changed_by, before_data, after_data)
          values (
            v_lineup.id, v_team, v_round, v_match, auth.uid(),
            jsonb_build_object('player_1_id', v_pp1, 'player_2_id', v_pp2),
            jsonb_build_object('player_1_id', v_p1,  'player_2_id', v_p2)
          );
        end if;
      end loop;
    end if;

    update lineups set
      status = case
                 when p_submit and v_prev = 'draft' then 'submitted'::lineup_status
                 when p_submit then 'modified'::lineup_status
                 else v_prev
               end,
      submitted_by = auth.uid(),
      submitted_at = coalesce(v_lineup.submitted_at, case when p_submit then v_now else null end)
    where id = v_lineup.id
    returning * into v_lineup;
  end if;

  -- Upsert de entradas (una por categoría con partido).
  for e in select * from jsonb_array_elements(p_entries) loop
    v_cat   := e->>'category_code';
    v_match := nullif(e->>'match_id', '')::uuid;
    v_p1    := nullif(e->>'player_1_id', '')::uuid;
    v_p2    := nullif(e->>'player_2_id', '')::uuid;

    if v_match is not null then
      insert into lineup_entries (lineup_id, match_id, category_code, player_1_id, player_2_id)
      values (v_lineup.id, v_match, v_cat, v_p1, v_p2)
      on conflict (lineup_id, category_code) do update
        set match_id = excluded.match_id,
            player_1_id = excluded.player_1_id,
            player_2_id = excluded.player_2_id;
    end if;
  end loop;

  return v_lineup.id;
end;
$$;
grant execute on function save_lineup(uuid, uuid, boolean, jsonb) to authenticated;
