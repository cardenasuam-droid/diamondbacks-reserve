-- 0052_slicewin_members.sql
-- Staging PRIVADO del export de miembros de Slicewin (la app externa donde
-- vivió la liga Diamondbacks pasada). Sirve para el cotejo de identidad de
-- F3/F5: nombres + correos reales de ~190 jugadoras que ayudarán a enlazar
-- fichas → personas y, cuando llegue el classement, a sembrar ratings.
--
-- PRIVACIDAD: son correos personales. Los DATOS no viven en el repo (es
-- público): se cargan por SQL directo, una vez. Esta tabla jamás se expone a
-- anon ni a vistas públicas (CLAUDE.md §5). El cotejo de F3 añadirá su
-- referencia a persons cuando esa tabla exista.

create table if not exists slicewin_members (
  id           uuid primary key default gen_random_uuid(),
  first_name   text not null,
  last_name    text,
  full_name    text generated always as (btrim(first_name || ' ' || coalesce(last_name, ''))) stored,
  email        text,
  phone        text,
  member_role  text,          -- Miembro | Admin | Propietario (tal cual el export)
  joined_at    timestamptz,
  is_active    boolean not null default true,
  imported_at  timestamptz not null default now()
);

create index if not exists idx_slicewin_members_email on slicewin_members (lower(email));

alter table slicewin_members enable row level security;

drop policy if exists "organizer all slicewin_members" on slicewin_members;
create policy "organizer all slicewin_members" on slicewin_members
  for all using (is_organizer()) with check (is_organizer());

drop policy if exists "viewer read slicewin_members" on slicewin_members;
create policy "viewer read slicewin_members" on slicewin_members
  for select using (is_viewer());

revoke all on slicewin_members from anon, authenticated, public;
grant select, insert, update, delete on slicewin_members to authenticated;
