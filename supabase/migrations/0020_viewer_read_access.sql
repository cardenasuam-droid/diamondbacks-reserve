-- 0020_viewer_read_access.sql
-- Acceso de SOLO LECTURA para el rol 'viewer' (agregado en 0019). Le da el mismo
-- ALCANCE DE LECTURA que un organizador (incluye datos privados de las fichas),
-- pero SIN una sola política de escritura: cualquier INSERT/UPDATE/DELETE lo
-- rechaza la RLS. La seguridad real vive aquí, no en la UI.
--
-- NOTA: se corre DESPUÉS de 0019 (transacción aparte), para que 'viewer' ya exista.

-- ¿El usuario actual es observador (solo lectura)?
create or replace function is_viewer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'viewer'
  );
$$;

-- Lectura amplia: una política SELECT por tabla administrativa. Refleja lo que ve
-- el organizador vía "organizer all", pero SOLO lectura. Idempotente.
-- (No se incluye staff_members: no hace falta y evita exponer los hashes de código.)
do $$
declare t text;
begin
  for t in select unnest(array[
    'seasons','teams','players','rounds','team_matchups','matches',
    'match_categories','category_eligibility_rules','time_blocks','courts',
    'lineups','lineup_entries','lineup_change_logs','match_results',
    'news_posts','league_documents','notifications','player_registrations'
  ])
  loop
    execute format('drop policy if exists "viewer read" on %I;', t);
    execute format('create policy "viewer read" on %I for select using (is_viewer());', t);
  end loop;
end$$;

-- profiles no está en el bucle anterior; el observador ve todos los perfiles
-- (para uniones/nombres de "revisado por", igual que el organizador).
drop policy if exists "viewer read profiles" on profiles;
create policy "viewer read profiles" on profiles for select using (is_viewer());

-- Las tablas del draft (drafts/draft_teams/draft_picks) ya tienen lectura pública
-- (0015), así que el observador las ve sin política extra. Las escrituras siguen
-- restringidas a is_organizer()/is_content_manager(), que el observador NO cumple.
