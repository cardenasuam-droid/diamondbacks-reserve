-- 0004_rls.sql
-- RLS base. Evita el footgun de "todo abierto": en Supabase, sin políticas y con
-- RLS activado, la anon key no lee nada. Aquí se abre SOLO lo público y se da al
-- organizador acceso amplio. Las políticas finas de capitán/jugador se refinan
-- por módulo (ver CLAUDE.md). Marcadas como TODO abajo.

-- ---------------------------------------------------------------------------
-- Activar RLS en todo
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array[
    'seasons','teams','players','profiles','rounds','team_matchups','matches',
    'match_categories','category_eligibility_rules','time_blocks','courts',
    'lineups','lineup_entries','lineup_change_logs','match_results',
    'news_posts','league_documents','notifications'
  ])
  loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- Vista pública de jugadores: SIN teléfono ni correo. El público lee rosters
-- desde aquí, nunca desde la tabla players directamente.
-- ---------------------------------------------------------------------------
create or replace view players_public as
select id, season_id, team_id, full_name, gender, category_code,
       is_captain, is_active
from players
where is_active = true;

grant select on players_public, team_standings, head_to_head, player_rankings
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lectura pública de datos deportivos
-- ---------------------------------------------------------------------------
create policy "public read seasons"     on seasons     for select using (true);
create policy "public read teams"        on teams       for select using (true);
create policy "public read rounds"       on rounds      for select using (status = 'published' or is_organizer());
create policy "public read matchups"     on team_matchups for select using (true);
create policy "public read matches"      on matches     for select using (true);
create policy "public read categories"   on match_categories for select using (true);
create policy "public read elig"         on category_eligibility_rules for select using (true);
create policy "public read timeblocks"   on time_blocks for select using (true);
create policy "public read courts"       on courts      for select using (true);
create policy "public read results"      on match_results for select using (true);
create policy "public read news"         on news_posts  for select using (published = true or is_organizer());
create policy "public read docs"         on league_documents for select using (is_active = true or is_organizer());

-- players: el público usa players_public (vista). La tabla cruda solo la leen:
--   - el organizador (todo)
--   - el propio jugador (su fila)
--   - el capitán (jugadores de su equipo)  [TODO: afinar contacto]
create policy "players self read" on players for select
  using (
    is_organizer()
    or exists (select 1 from profiles pr where pr.id = auth.uid() and pr.player_id = players.id)
    or exists (
      select 1 from profiles pr join players me on me.id = pr.player_id
      where pr.id = auth.uid() and me.is_captain = true and me.team_id = players.team_id
    )
  );

-- profiles: cada quien lee su propio profile; el organizador lee todos.
create policy "profiles self read" on profiles for select
  using (id = auth.uid() or is_organizer());
create policy "profiles self update" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Escritura del organizador: acceso amplio (ALL) en tablas administrativas.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array[
    'seasons','teams','players','rounds','team_matchups','matches',
    'match_categories','category_eligibility_rules','time_blocks','courts',
    'lineups','lineup_entries','lineup_change_logs','match_results',
    'news_posts','league_documents','notifications'
  ])
  loop
    execute format(
      'create policy "organizer all" on %I for all using (is_organizer()) with check (is_organizer());', t);
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- TODO (refinar por módulo, ver plan secciones 12 y 18):
--   * Capitán: insert/update de lineups y lineup_entries SOLO de su equipo,
--     respetando el lock y el límite de cambios (los triggers ya lo blindan).
--   * Capitán: insert de match_results (estado 'reported') SOLO de partidos de
--     su equipo; nunca 'validated'.
--   * Web manager: insert/update de news_posts y league_documents.
--   * Jugador: read de notifications dirigidas a él / su equipo / su rol.
-- ---------------------------------------------------------------------------
