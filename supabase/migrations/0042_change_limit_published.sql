-- 0042_change_limit_published.sql
-- Regla nueva del cupo de cambios + reinicio a 0. [Fase 0.2 del diagnóstico
-- 2026-07-20 — aplicar ANTES del candado de J2, sábado 25-jul 07:00]
--
-- REGLA ANTERIOR (rota): consumía cupo todo cambio posterior al PRIMER ENVÍO,
-- sin importar quién lo hiciera. Dos fallos: (a) la capitana quemaba cupo
-- refinando su alineación días antes de que nadie la viera; (b) las ediciones
-- del ORGANIZADOR contaban contra el equipo — el `if is_organizer() then return`
-- de enforce_change_limit (0002:121) solo lo eximía de DISPARAR el tope, no de
-- CONSUMIRLO: sus filas se insertaban y contaban igual. Resultado real: Legacy
-- llegó a 11/5 antes de J1 sin que su capitana hiciera un solo cambio.
--
-- REGLA NUEVA (decidida por la organizadora, 2026-07-20): el cupo protege el ROL
-- PUBLICADO. Un cambio consume cupo si y solo si, en el momento de hacerse, la
-- alineación ya estaba publicada (lineups.locked_at not null, 0036). Todo lo
-- anterior a la publicación — borradores, reenvíos, correcciones del organizador
-- en el armado — es libre. Da igual QUIÉN ejecute el cambio post-publicación:
-- si el organizador lo hace a petición del equipo, cuenta para el equipo.
--
-- REINICIO: la columna nueva nace en false, así que las 11 filas históricas
-- (todas pre-publicación) dejan de contar y TODOS los equipos quedan en 0/5.
-- El historial de auditoría se conserva íntegro; no se borra nada.
--
-- HUECO QUE ESTA MIGRACIÓN TAMBIÉN CIERRA: publish_round_lineups publica
-- también alineaciones en estado 'draft' (nunca enviadas), y save_lineup solo
-- registraba cambios cuando status <> 'draft'. Editar una alineación publicada
-- pero nunca enviada no dejaba NI registro NI cupo. Ahora se registra todo
-- cambio sobre alineación enviada O publicada.

-- ---------------------------------------------------------------------------
-- 1. La marca: ¿este cambio contó contra el cupo?
--    Se decide y congela AL INSERTAR (¿estaba publicada la alineación en ese
--    momento?), no se deriva después: locked_at cambia con la publicación y un
--    cambio hecho ANTES de publicar no debe empezar a contar retroactivamente.
-- ---------------------------------------------------------------------------
alter table lineup_change_logs
  add column if not exists counts_against_limit boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. save_lineup: idéntica a 0038 salvo el bloque de registro de cambios.
--    (a) registra cuando la alineación estaba enviada O publicada;
--    (b) el log lleva counts_against_limit = (ya estaba publicada).
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

    -- Se registra el cambio si la alineación ya estaba ENVIADA o ya estaba
    -- PUBLICADA (0042: antes solo la primera condición — una alineación
    -- publicada en borrador se editaba sin dejar rastro). El cambio CUENTA
    -- contra el cupo solo si estaba publicada en este momento.
    if v_prev <> 'draft' or v_lineup.locked_at is not null then
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
            (lineup_id, team_id, round_id, match_id, changed_by,
             before_data, after_data, counts_against_limit)
          values (
            v_lineup.id, v_team, v_round, v_match, auth.uid(),
            jsonb_build_object('player_1_id', v_pp1, 'player_2_id', v_pp2),
            jsonb_build_object('player_1_id', v_p1,  'player_2_id', v_p2),
            v_lineup.locked_at is not null
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

-- ---------------------------------------------------------------------------
-- 3. enforce_change_limit: el tope se evalúa SOLO sobre los cambios que cuentan,
--    y SOLO bloquea inserciones que cuentan. Dos detalles deliberados:
--    - Un cambio pre-publicación (counts=false) NUNCA se bloquea, aunque el
--      equipo esté en 5/5: el cupo protege el rol publicado, no el armado de
--      una jornada futura.
--    - El organizador no es BLOQUEADO por el tope (autoridad final: puede
--      ejecutar un 6º cambio si lo juzga necesario), pero su cambio SÍ queda
--      registrado y SÍ consume cupo si es post-publicación. Esto corrige el
--      comentario engañoso de 0002 ("no consumen el cupo": sí consumían).
-- ---------------------------------------------------------------------------
create or replace function enforce_change_limit()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  used int;
  season uuid;
begin
  -- Los cambios que no cuentan (pre-publicación) pasan siempre.
  if not new.counts_against_limit then
    return new;
  end if;

  -- El organizador no es bloqueado; la fila se inserta y cuenta igual.
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

  if used >= 5 then
    raise exception
      'Límite alcanzado: el equipo ya usó sus 5 cambios de la temporada.';
  end if;

  return new;
end;
$$;
-- El trigger trg_change_limit (0002) ya apunta a esta función; no se recrea.
