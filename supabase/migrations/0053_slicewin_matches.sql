-- 0053_slicewin_matches.sql
-- Staging PRIVADO del export de partidos de Slicewin (la liga Diamondbacks
-- pasada): 4 jugadoras por partido (2v2), marcador y el CAMBIO DE ELO que
-- Slicewin aplicó a cada jugadora. Con esto el rating final de la liga pasada
-- es reproducible: semilla de su categoría (misma escalera que Reserve
-- femenil, confirmado por el organizador) + suma de deltas por jugadora.
-- F5 lo usará para sembrar el rating de la 6a Edición vía el cotejo.
--
-- PRIVACIDAD: mismo criterio que 0052 — los DATOS se cargan por SQL directo,
-- nunca viven en el repo público ni se exponen a anon.

-- Catálogo uid → nombre visible (los UIDs de Slicewin son estables; el nombre
-- se repite en cada partido del export, aquí se guarda una vez).
create table if not exists slicewin_players (
  uid          text primary key,
  display_name text not null,
  imported_at  timestamptz not null default now()
);

create table if not exists slicewin_matches (
  id          text primary key,              -- ID de partido de Slicewin
  played_at   timestamptz,
  t1_uid1     text references slicewin_players(uid),
  t1_uid2     text references slicewin_players(uid),
  t2_uid1     text references slicewin_players(uid),
  t2_uid2     text references slicewin_players(uid),
  result_t1   text,                          -- win | loss | draw (perspectiva equipo 1)
  score       text,                          -- "7-6, 6-2" tal cual el export
  -- Estado de Slicewin: SOLO 'validated_results' con elo_applied cuenta para
  -- sumas de Elo (el export trae también rejected/canceled).
  status      text,
  elo_applied boolean not null default false,
  abandoned   boolean not null default false,
  elo_d_t1p1  numeric, elo_d_t1p2 numeric,   -- cambio de Elo por jugadora
  elo_d_t2p1  numeric, elo_d_t2p2 numeric,
  imported_at timestamptz not null default now()
);

create index if not exists idx_slicewin_matches_played on slicewin_matches (played_at);

alter table slicewin_players enable row level security;
alter table slicewin_matches enable row level security;

drop policy if exists "organizer all slicewin_players" on slicewin_players;
create policy "organizer all slicewin_players" on slicewin_players
  for all using (is_organizer()) with check (is_organizer());
drop policy if exists "viewer read slicewin_players" on slicewin_players;
create policy "viewer read slicewin_players" on slicewin_players
  for select using (is_viewer());

drop policy if exists "organizer all slicewin_matches" on slicewin_matches;
create policy "organizer all slicewin_matches" on slicewin_matches
  for all using (is_organizer()) with check (is_organizer());
drop policy if exists "viewer read slicewin_matches" on slicewin_matches;
create policy "viewer read slicewin_matches" on slicewin_matches
  for select using (is_viewer());

revoke all on slicewin_players, slicewin_matches from anon, authenticated, public;
grant select, insert, update, delete on slicewin_players, slicewin_matches to authenticated;
