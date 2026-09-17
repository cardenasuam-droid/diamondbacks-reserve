-- 0054_americano_hardening.sql
-- Endurecimientos surgidos de la revisión del PR #1 (Codex). Tres arreglos:
--   (1) las vistas americano NO deben filtrar resultados de jornadas en
--       borrador a anon (las vistas corren con el dueño y saltan la RLS);
--   (2) crear/editar un juego con sus 4 jugadoras debe ser ATÓMICO (el
--       delete+insert del cliente podía dejar un juego sin jugadoras si el
--       insert chocaba con un candado);
--   (3) cerrar la inscripción debe ser autoritativo en el SERVIDOR: la
--       policy pública de player_registrations exige registration_open.

-- ---------------------------------------------------------------------------
-- 1. per_player_ind_match: solo jornadas PUBLICADAS.
--
-- La vista es de lectura pública (0051) y, como toda vista del dueño, evalúa
-- sin la RLS del consultante: sin este filtro, anon podía leer resultados de
-- una jornada en borrador (y la tabla los sumaba antes de publicar). La tabla
-- OFICIAL solo debe reflejar lo publicado; el organizador ve borradores por
-- las tablas base (su RLS), no por la vista. ind_standings no cambia de
-- definición: hereda el filtro al leer esta vista.
-- ---------------------------------------------------------------------------
create or replace view per_player_ind_match as
with base as (
  select r.id as result_id, r.match_id, im.round_id, im.season_id, im.category_code,
         im.phase, r.is_walkover, r.walkover_side, r.winner_side,
         r.set1_side1, r.set2_side1, r.set3_side1,
         r.set1_side2, r.set2_side2, r.set3_side2
    from ind_match_results r
    join ind_matches im on im.id = r.match_id
    join rounds rd on rd.id = im.round_id and rd.status = 'published'
   where r.status in ('validated', 'walkover', 'corrected')
),
sides as (
  select base.*, imp.player_id, imp.side,
         case when imp.side = 1 then set1_side1 else set1_side2 end as s1,
         case when imp.side = 1 then set2_side1 else set2_side2 end as s2,
         case when imp.side = 1 then set3_side1 else set3_side2 end as s3,
         case when imp.side = 1 then set1_side2 else set1_side1 end as o1,
         case when imp.side = 1 then set2_side2 else set2_side1 end as o2,
         case when imp.side = 1 then set3_side2 else set3_side1 end as o3
    from base
    join ind_match_players imp on imp.match_id = base.match_id
),
calc as (
  select *,
    (set_won(s1,o1) + set_won(s2,o2) + set_won(s3,o3)) as raw_sets_won,
    (set_won(o1,s1) + set_won(o2,s2) + set_won(o3,s3)) as raw_sets_lost,
    (coalesce(s1,0) + coalesce(s2,0) + coalesce(s3,0)) as raw_games_won,
    (coalesce(o1,0) + coalesce(o2,0) + coalesce(o3,0)) as raw_games_lost
  from sides
)
select
  result_id, match_id, round_id, season_id, category_code, phase, player_id, side,
  case when is_walkover then (side <> walkover_side)
       else side = winner_side end as won,
  case when is_walkover then case when side <> walkover_side then 2 else 0 end
       else raw_sets_won end as sets_won,
  case when is_walkover then case when side <> walkover_side then 0 else 2 end
       else raw_sets_lost end as sets_lost,
  case when is_walkover then case when side <> walkover_side then 12 else 0 end
       else raw_games_won end as games_won,
  case when is_walkover then case when side <> walkover_side then 0 else 12 end
       else raw_games_lost end as games_lost,
  case
    when is_walkover then case when side <> walkover_side then 3 else 0 end
    when side = winner_side then 3
    when raw_sets_won >= 1 then 1
    else 0
  end as points
from calc;

-- ---------------------------------------------------------------------------
-- 2. save_ind_match: alta/edición ATÓMICA de un juego con sus 4 jugadoras.
--
-- SECURITY INVOKER a propósito: corre con los permisos y la RLS de quien
-- llama, así que solo el organizador puede escribir (mismas policies de
-- 0051); no eleva nada. PostgREST envuelve la llamada en una transacción:
-- si el candado "una jugadora por jornada" (o cualquier otro) rechaza a la
-- cuarta jugadora, TODO se revierte y el juego conserva su alineación previa
-- — antes, el cliente borraba y reinsertaba, y un fallo a media edición
-- dejaba el juego (y su resultado) sin jugadoras.
-- ---------------------------------------------------------------------------
create or replace function save_ind_match(
  p_match_id      uuid,
  p_season_id     uuid,
  p_round_id      uuid,
  p_category_code text,
  p_court_id      uuid,
  p_time_block_id uuid,
  p_player_ids    uuid[]
) returns uuid
language plpgsql set search_path = public, pg_temp as $$
declare
  v_match uuid := p_match_id;
  v_distinct int;
begin
  if p_player_ids is null or array_length(p_player_ids, 1) <> 4 then
    raise exception 'Un juego necesita exactamente 4 jugadoras.';
  end if;
  select count(distinct u) into v_distinct from unnest(p_player_ids) u where u is not null;
  if v_distinct <> 4 then
    raise exception 'Las 4 jugadoras deben ser distintas.';
  end if;

  if v_match is null then
    insert into ind_matches (season_id, round_id, category_code, court_id, time_block_id)
    values (p_season_id, p_round_id, p_category_code, p_court_id, p_time_block_id)
    returning id into v_match;
  else
    update ind_matches
       set category_code = p_category_code,
           court_id      = p_court_id,
           time_block_id = p_time_block_id
     where id = v_match;
    if not found then
      raise exception 'Juego no encontrado (¿permisos?).';
    end if;
    delete from ind_match_players where match_id = v_match;
  end if;

  insert into ind_match_players (match_id, player_id, side, slot)
  select v_match, p_player_ids[i],
         case when i <= 2 then 1 else 2 end,
         case when i % 2 = 1 then 1 else 2 end
    from generate_series(1, 4) as i;

  return v_match;
end $$;

revoke all on function save_ind_match(uuid, uuid, uuid, text, uuid, uuid, uuid[]) from public, anon;
grant execute on function save_ind_match(uuid, uuid, uuid, text, uuid, uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Cerrar inscripción = cerrado DE VERDAD: la policy pública exige que la
--    edición exista y tenga registration_open. Un formulario abierto antes
--    del cierre (o un cliente directo con el season_id) ya no puede seguir
--    metiendo inscripciones. season_id nulo deja de aceptarse: toda
--    inscripción pertenece a una edición.
-- ---------------------------------------------------------------------------
drop policy if exists "public submit registration" on player_registrations;
create policy "public submit registration" on player_registrations
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and created_player_id is null
    and reviewed_by is null
    and reviewed_at is null
    and review_notes is null
    and payment_verified_at is null
    and payment_verified_by is null
    and season_id is not null
    and exists (
      select 1 from seasons s
       where s.id = season_id and s.registration_open
    )
  );
