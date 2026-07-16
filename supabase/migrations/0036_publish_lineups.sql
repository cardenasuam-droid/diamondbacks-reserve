-- 0036_publish_lineups.sql
-- Fase 2 del cambio de alineaciones: a la hora del cierre (sábado 07:00), el
-- ORGANIZADOR pulsa "Cerrar y publicar jornada". El navegador del organizador ya
-- generó y guardó (con save_lineup, que salta el candado para el organizador) una
-- alineación aleatoria VÁLIDA para cada equipo que no la envió; esta RPC solo
-- MARCA la jornada como publicada y la vuelve PÚBLICA.
--
-- "Publicada" = lineups.locked_at no nulo. Es la señal única de visibilidad
-- pública (la generación aleatoria vive en el cliente, en TS testeado).

-- ---------------------------------------------------------------------------
-- Publicar todas las alineaciones de una jornada (solo organizador).
-- ---------------------------------------------------------------------------
create or replace function publish_round_lineups(p_round_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not is_organizer() then
    raise exception 'Solo el organizador puede publicar las alineaciones de la jornada.';
  end if;

  update lineups l
  set locked_at = now()
  from team_matchups tm
  where tm.id = l.team_matchup_id
    and tm.round_id = p_round_id
    and l.locked_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end $$;
grant execute on function publish_round_lineups(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Lectura PÚBLICA de las alineaciones YA PUBLICADAS (locked_at no nulo). Antes del
-- cierre siguen privadas (solo su capitán y el organizador, políticas 0004/0006).
-- Aditivas (las permisivas se combinan con OR). Los ids de jugador ya son públicos
-- (players_public); no se expone nada sensible.
-- ---------------------------------------------------------------------------
drop policy if exists "public read published lineups" on lineups;
create policy "public read published lineups" on lineups for select
  using (locked_at is not null);

drop policy if exists "public read published entries" on lineup_entries;
create policy "public read published entries" on lineup_entries for select
  using (
    exists (
      select 1 from lineups l
      where l.id = lineup_entries.lineup_id and l.locked_at is not null
    )
  );

grant select on lineups, lineup_entries to anon, authenticated;
