-- 0021_reset_draft.sql
-- Reinicio del draft para PRUEBAS. Solo organizador. Devuelve al pool a los
-- jugadores que fueron elegidos en este draft, borra el board y deja el draft en
-- 'setup' (listo para re-ordenar e iniciar de nuevo). NO toca a capitanas ni a
-- jugadores que ya estaban en un equipo antes del draft (no aparecen en draft_picks).

create or replace function reset_draft(p_draft_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d drafts%rowtype;
begin
  if not is_organizer() then
    raise exception 'Solo el organizador puede reiniciar el draft.';
  end if;

  select * into d from drafts where id = p_draft_id for update;
  if not found then raise exception 'Draft no encontrado.'; end if;

  -- Devuelve al pool (team_id = null) a cada jugador elegido en ESTE draft.
  update players pl
  set team_id = null
  from draft_picks dp
  where dp.draft_id = p_draft_id
    and dp.player_id = pl.id;

  -- Borra el board (se regenera al volver a iniciar con start_draft).
  delete from draft_picks where draft_id = p_draft_id;

  -- Vuelve a 'setup': se conserva el orden (draft_teams) para no reconfigurarlo.
  update drafts
  set status = 'setup', pick_deadline = null, paused_remaining_ms = null
  where id = p_draft_id;
end $$;

grant execute on function reset_draft(uuid) to authenticated;
