-- 0024_fix_pick_picked_by.sql
-- BUGFIX: al elegir un pick, las CAPITANAS recibían
--   "insert or update on table draft_picks violates foreign key
--    constraint draft_picks_picked_by_fkey".
--
-- Causa: make_pick guardaba `picked_by = current_player_id()`, que devuelve
-- profiles.player_id (un players.id). Pero draft_picks.picked_by REFERENCIA
-- profiles(id). Para el organizador (player_id null) guardaba null → sin FK; para
-- la capitana guardaba su players.id, inexistente en profiles → viola la FK.
--
-- Arreglo: registrar quién eligió como su PERFIL, auth.uid() (= profiles.id).
-- Se reemplaza make_pick completo (idéntico a 0023, solo cambia esa línea).

create or replace function make_pick(p_draft_id uuid, p_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d        drafts%rowtype;
  slot     draft_picks%rowtype;
  v_cap    uuid;
  v_player players%rowtype;
begin
  select * into d from drafts where id = p_draft_id for update;
  if not found then raise exception 'Draft no encontrado.'; end if;
  if d.status <> 'active' then raise exception 'El draft no está activo.'; end if;

  -- Reloj impuesto por el servidor: turno vencido → selección automática y salida.
  if not is_organizer() and d.pick_deadline is not null and now() > d.pick_deadline then
    perform auto_pick(p_draft_id);
    return;
  end if;

  select * into slot from draft_picks
  where draft_id = p_draft_id and player_id is null order by pick_number limit 1;
  if not found then raise exception 'No hay picks pendientes.'; end if;

  v_cap := captain_team_id();
  if not is_organizer() and (v_cap is null or v_cap <> slot.team_id) then
    raise exception 'No es tu turno.';
  end if;

  select * into v_player from players where id = p_player_id;
  if not found then raise exception 'Jugador no encontrado.'; end if;
  if v_player.team_id is not null then raise exception 'Ese jugador ya tiene equipo.'; end if;
  if v_player.is_waitlisted then
    raise exception 'Ese jugador está en lista de espera; regrésalo al pool antes de elegirlo.';
  end if;
  if not v_player.is_active or v_player.season_id <> d.season_id
     or v_player.category_code <> slot.category_code then
    raise exception 'Jugador no elegible para este pick.';
  end if;

  update draft_picks
  set player_id = p_player_id, picked_at = now(), was_auto = false, picked_by = auth.uid()
  where id = slot.id;
  update players set team_id = slot.team_id where id = p_player_id;

  perform advance_draft(p_draft_id);
end $$;
