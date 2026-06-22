-- 0007_save_lineup_rpc.sql
-- Guardado atómico de alineación en UNA transacción. Sustituye la secuencia de
-- llamadas del cliente (que no era transaccional: un log podía quedar huérfano).
--
-- SECURITY INVOKER (por defecto en plpgsql): RLS y los triggers (lock 1h,
-- límite de 5 cambios) SIGUEN aplicando dentro de la función. El team_id se
-- deriva en el servidor (captain_team_id / organizador), nunca se confía del
-- cliente, así un capitán no puede tocar a otro equipo.

-- Clave estable de una pareja: conjunto NO ordenado de ids (invertir el orden de
-- los dos jugadores no es un cambio real). Coalesce a '' para tratar los huecos.
create or replace function pair_key(a uuid, b uuid)
returns text language sql immutable as $$
  select string_agg(x, '|' order by x)
  from (values (coalesce(a::text, '')), (coalesce(b::text, ''))) t(x);
$$;

create or replace function save_lineup(
  p_team_matchup_id uuid,
  p_team_id uuid,          -- solo lo usa el organizador; para el capitán se ignora
  p_submit boolean,
  p_entries jsonb          -- [{category_code, match_id, player_1_id, player_2_id}]
) returns uuid
language plpgsql
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
  -- Equipo de forma segura.
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

  select min(m.round_id) into v_round
  from matches m where m.team_matchup_id = p_team_matchup_id;

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
