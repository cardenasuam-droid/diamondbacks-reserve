-- 0049_leagues_editions.sql
-- Plataforma multi-liga, fase 1 (plan_plataforma_multi_liga.md §4.1 y §5-F1):
-- nace el contenedor `leagues` (liga/torneo) y `seasons` pasa a ser "la edición"
-- de una liga. Además: catálogos por edición (categorías y horarios), cancha 10
-- y la 6a Edición de la Liga Femenil con inscripciones abiertas.
--
-- Qué NO hace a propósito: no toca identidad/auth (persons llega en F3), no
-- crea el módulo americano (F2), no cambia ninguna consulta existente. La
-- Team League 2026 sigue siendo la única temporada 'active': useActiveSeason
-- y todas las páginas públicas quedan idénticas. La edición femenil nace en
-- 'draft' con `registration_open = true`: solo la ven el formulario nuevo de
-- /registro y el panel del organizador.

-- ---------------------------------------------------------------------------
-- 1. leagues — la liga/torneo estable por encima de sus ediciones
--
-- `kind` decide qué módulo la opera: 'team_league' (Reserve), 'americano'
-- (femenil: individual con pareja rotativa) o 'tournament' (futuro).
-- `theme` es la identidad visual de la liga (decisión 2026-09-16: cada liga
-- con colores propios). Se guarda como DATOS para poder recalibrar sin deploy;
-- la femenil arranca con una paleta PROVISIONAL (pendiente heredar la de la
-- app anterior) y el CSS la aplica por slug ([data-league], index.css).
-- ---------------------------------------------------------------------------
create table if not exists leagues (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  kind       text not null check (kind in ('team_league', 'americano', 'tournament')),
  theme      jsonb,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_leagues_updated_at on leagues;
create trigger trg_leagues_updated_at
  before update on leagues
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. seasons = ediciones: liga a la que pertenecen + metadatos de inscripción
--
-- max_players: cupo duro de la edición (la femenil: 120 = 10 canchas × 3
-- horarios × 4 jugadoras). Lo hace cumplir un trigger en 0050, no solo la UI.
-- payment_instructions: cuota y datos de pago que muestra el formulario; NULL
-- oculta la sección de pago (aún sin datos → el form no promete nada).
-- ---------------------------------------------------------------------------
alter table seasons
  add column if not exists league_id            uuid references leagues(id),
  add column if not exists edition_number       int,
  add column if not exists slug                 text,
  add column if not exists registration_open    boolean not null default false,
  add column if not exists max_players          int check (max_players is null or max_players > 0),
  add column if not exists payment_instructions text;

create unique index if not exists seasons_league_slug
  on seasons (league_id, slug) where slug is not null;

-- ---------------------------------------------------------------------------
-- 3. Catálogos POR EDICIÓN (data-driven, mismo criterio que
--    category_eligibility_rules): qué categorías se juegan y qué bloques de
--    horario usa cada edición. El formulario de inscripción y (en F2) el
--    calendario leen de aquí, no de listas hardcodeadas.
-- ---------------------------------------------------------------------------
create table if not exists season_categories (
  season_id     uuid not null references seasons(id) on delete cascade,
  category_code text not null references match_categories(code),
  primary key (season_id, category_code)
);

create table if not exists season_time_blocks (
  season_id     uuid not null references seasons(id) on delete cascade,
  time_block_id uuid not null references time_blocks(id),
  primary key (season_id, time_block_id)
);

-- ---------------------------------------------------------------------------
-- 4. RLS y privilegios (patrón 0039: RLS + revoke/grant explícitos)
-- ---------------------------------------------------------------------------
alter table leagues            enable row level security;
alter table season_categories  enable row level security;
alter table season_time_blocks enable row level security;

drop policy if exists "public read leagues" on leagues;
create policy "public read leagues" on leagues for select using (true);
drop policy if exists "organizer all leagues" on leagues;
create policy "organizer all leagues" on leagues
  for all using (is_organizer()) with check (is_organizer());

drop policy if exists "public read season_categories" on season_categories;
create policy "public read season_categories" on season_categories for select using (true);
drop policy if exists "organizer all season_categories" on season_categories;
create policy "organizer all season_categories" on season_categories
  for all using (is_organizer()) with check (is_organizer());

drop policy if exists "public read season_time_blocks" on season_time_blocks;
create policy "public read season_time_blocks" on season_time_blocks for select using (true);
drop policy if exists "organizer all season_time_blocks" on season_time_blocks;
create policy "organizer all season_time_blocks" on season_time_blocks
  for all using (is_organizer()) with check (is_organizer());

revoke all on leagues, season_categories, season_time_blocks
  from anon, authenticated, public;
grant select on leagues, season_categories, season_time_blocks to anon, authenticated;
grant insert, update, delete on leagues, season_categories, season_time_blocks to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Datos: las dos ligas, el backfill de Reserve y la 6a Edición femenil
--
-- Numeración confirmada por el organizador (2026-09-16): la nueva femenil es
-- la 6a EDICIÓN de la Liga Diamondbacks (las hojas de Drive documentan hasta
-- la 5a, mar–may 2026, la que sirvió diamondbacksleague.netlify.app).
-- ---------------------------------------------------------------------------
insert into leagues (slug, name, kind, theme, sort_order) values
  (
    'reserve',
    'Diamondbacks Reserve · Team League',
    'team_league',
    -- Identidad ya viva en index.css (esmeralda + oro). Se registra como datos
    -- por consistencia; el CSS sigue siendo la fuente aplicada.
    '{"primary": "#199e69", "accent": "#e9c14e", "label": "Esmeralda y Oro"}'::jsonb,
    1
  ),
  (
    'femenil',
    'Liga Diamondbacks Femenil',
    'americano',
    -- PROVISIONAL: pendiente heredar los colores de la app anterior (no fue
    -- posible verla desde este entorno). Cambiar aquí + [data-league="femenil"]
    -- en index.css cuando el organizador los pase.
    '{"primary": "#d6367f", "accent": "#e9c14e", "label": "Provisional (rosa)", "provisional": true}'::jsonb,
    2
  )
on conflict (slug) do nothing;

-- Toda temporada existente pertenece a Reserve (solo hay una: Team League 2026).
update seasons
   set league_id      = (select id from leagues where slug = 'reserve'),
       edition_number = coalesce(edition_number, 1),
       slug           = coalesce(slug, '2026'),
       -- La bandeja de Reserve sigue abierta (pool/lista de espera): /registro
       -- conserva su comportamiento actual hasta que el organizador la cierre.
       registration_open = true
 where league_id is null;

-- Con el backfill hecho, la pertenencia a liga es obligatoria.
alter table seasons alter column league_id set not null;

-- La 6a Edición femenil: lunes 12-oct-2026, 8 lunes consecutivos (última
-- jornada 30-nov-2026), cupo 120. Nace 'draft': NO es la temporada activa.
insert into seasons (name, start_date, end_date, status, league_id,
                     edition_number, slug, registration_open, max_players)
select '6a Edición', date '2026-10-12', date '2026-11-30', 'draft',
       l.id, 6, '6a-edicion', true, 120
  from leagues l
 where l.slug = 'femenil'
   and not exists (
     select 1 from seasons s where s.league_id = l.id and s.slug = '6a-edicion'
   );

-- Categorías de la edición femenil: 3a–7a (mapa directo a FEM_3…FEM_7).
insert into season_categories (season_id, category_code)
select s.id, c.code
  from seasons s
  join leagues l on l.id = s.league_id and l.slug = 'femenil'
  join match_categories c on c.code in ('FEM_3', 'FEM_4', 'FEM_5', 'FEM_6', 'FEM_7')
 where s.slug = '6a-edicion'
on conflict do nothing;

-- Horarios de la edición femenil: 6:30, 7:45 y 9:00 pm — los bloques 18:30,
-- 19:45 y 21:00 que ya existen en time_blocks (seed).
insert into season_time_blocks (season_id, time_block_id)
select s.id, tb.id
  from seasons s
  join leagues l on l.id = s.league_id and l.slug = 'femenil'
  join time_blocks tb on tb.label in ('18:30', '19:45', '21:00')
 where s.slug = '6a-edicion'
on conflict do nothing;

-- Backfill de Reserve: sus categorías y horarios reales son los que sus
-- partidos ya usan (fuente: matches, no una lista a mano).
insert into season_categories (season_id, category_code)
select distinct r.season_id, m.category_code
  from matches m
  join rounds r on r.id = m.round_id
on conflict do nothing;

insert into season_time_blocks (season_id, time_block_id)
select distinct r.season_id, m.time_block_id
  from matches m
  join rounds r on r.id = m.round_id
on conflict do nothing;

-- La femenil juega en 10 canchas; el catálogo tenía 9.
insert into courts (name, number) values ('Cancha 10', 10)
on conflict (number) do update set name = excluded.name;
