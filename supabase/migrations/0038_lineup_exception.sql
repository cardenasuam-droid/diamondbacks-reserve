-- 0038_lineup_exception.sql
-- Excepción por falta de jugadores: la capitana puede alinear a alguien fuera de
-- su categoría o repetirlo (dobletear), con confirmación, SOLO con un jugador de la
-- misma categoría o más débil (número mayor) y del mismo género. Se marca la pareja
-- como excepción para mostrar ⚠️ en el rol público.
--
-- La validación de la regla vive en el cliente (validateLineup, como toda la
-- validación de alineación). Aquí solo se persiste la marca.

-- ---------------------------------------------------------------------------
-- Marca de excepción por categoría (una fila de lineup_entries = una categoría).
-- ---------------------------------------------------------------------------
alter table lineup_entries add column if not exists is_exception boolean not null default false;

-- ---------------------------------------------------------------------------
-- save_lineup: además del arreglo de 0037 (round_id desde team_matchups), ahora
-- persiste is_exception por categoría (viene en el jsonb de entradas).
-- ---------------------------------------------------------------------------
create or replace function save_lineup(
  p_team_matchup_id uuid,
  p_team_id uuid,          -- solo lo usa el organizador; para el capitán se ignora
  p_submit boolean,
  p_entries jsonb          -- [{category_code, match_id, player_1_id, player_2_id, is_exception}]
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

  perform pg_advisory_xact_lock(hashtextextended(v_team::text, 0));

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

  -- Upsert de entradas (una por categoría con partido). Guarda is_exception.
  for e in select * from jsonb_array_elements(p_entries) loop
    v_cat   := e->>'category_code';
    v_match := nullif(e->>'match_id', '')::uuid;
    v_p1    := nullif(e->>'player_1_id', '')::uuid;
    v_p2    := nullif(e->>'player_2_id', '')::uuid;

    if v_match is not null then
      insert into lineup_entries (lineup_id, match_id, category_code, player_1_id, player_2_id, is_exception)
      values (v_lineup.id, v_match, v_cat, v_p1, v_p2, coalesce((e->>'is_exception')::boolean, false))
      on conflict (lineup_id, category_code) do update
        set match_id = excluded.match_id,
            player_1_id = excluded.player_1_id,
            player_2_id = excluded.player_2_id,
            is_exception = excluded.is_exception;
    end if;
  end loop;

  return v_lineup.id;
end;
$$;
grant execute on function save_lineup(uuid, uuid, boolean, jsonb) to authenticated;
