-- 0010_content.sql
-- Noticias y reglamento: permite que el WEB MANAGER (además del organizador)
-- gestione contenido, y crea el bucket de Storage para PDF/imágenes.

-- ¿El usuario actual gestiona contenido? (organizador o web manager)
create or replace function is_content_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('organizer', 'web_manager')
  );
$$;

-- ---------------------------------------------------------------------------
-- news_posts: lectura pública de publicadas (+ borradores para gestores) y
-- escritura de gestores de contenido.
-- ---------------------------------------------------------------------------
drop policy if exists "public read news" on news_posts;
create policy "read news" on news_posts for select
  using (published = true or is_content_manager());
create policy "content manage news" on news_posts for all
  using (is_content_manager()) with check (is_content_manager());

-- ---------------------------------------------------------------------------
-- league_documents: igual (reglamento).
-- ---------------------------------------------------------------------------
drop policy if exists "public read docs" on league_documents;
create policy "read docs" on league_documents for select
  using (is_active = true or is_content_manager());
create policy "content manage docs" on league_documents for all
  using (is_content_manager()) with check (is_content_manager());

-- ---------------------------------------------------------------------------
-- Storage: bucket público 'media' (logos, imágenes de noticias, reglamento PDF).
-- Lectura pública; subida/edición solo para gestores de contenido.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "public read media" on storage.objects;
create policy "public read media" on storage.objects for select
  using (bucket_id = 'media');

drop policy if exists "content upload media" on storage.objects;
create policy "content upload media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and is_content_manager());

drop policy if exists "content update media" on storage.objects;
create policy "content update media" on storage.objects for update to authenticated
  using (bucket_id = 'media' and is_content_manager())
  with check (bucket_id = 'media' and is_content_manager());

drop policy if exists "content delete media" on storage.objects;
create policy "content delete media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and is_content_manager());
