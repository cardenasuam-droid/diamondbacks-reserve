-- 0014_player_registrations.sql
-- Inscripción pública de jugadores (página /registro).
--
-- Diseño: bandeja de entrada, NO escritura directa en players. La tabla players
-- (CLAUDE.md §3.2) es la fuente de verdad deportiva y exige team_id/season_id y
-- una categoría asignada por el comité; además no debe abrirse a inserciones
-- anónimas. Por eso quien se inscribe escribe AQUÍ (status 'pending'), y el
-- organizador revisa y, al aprobar, crea la ficha en players. Esto materializa
-- el requisito "categoría sujeta a revisión del comité".

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
-- Lado de juego declarado por el jugador (no existe en players; vive aquí para
-- que el comité lo considere al armar parejas).
create type player_position    as enum ('drive', 'reves', 'ambas');
create type registration_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- Bandeja de inscripciones
-- ---------------------------------------------------------------------------
create table player_registrations (
  id                       uuid primary key default gen_random_uuid(),
  -- temporada para la que se inscribe (contexto). El comité puede reasignar.
  season_id                uuid references seasons(id) on delete set null,
  full_name                text not null,
  phone                    text not null,            -- privado (ver RLS): nunca se expone a anon
  requested_category_code  text not null references match_categories(code),
  position                 player_position not null,
  comment                  text,                     -- opcional (p. ej. con quién quiere jugar)
  status                   registration_status not null default 'pending',
  -- Trazabilidad de la revisión (la rellena el organizador, no el público).
  created_player_id        uuid references players(id) on delete set null,
  reviewed_by              uuid references profiles(id) on delete set null,
  reviewed_at              timestamptz,
  review_notes             text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  -- Validación de defensa en profundidad (además de Zod en el cliente).
  constraint full_name_len  check (char_length(btrim(full_name)) between 2 and 120),
  constraint phone_digits    check (char_length(regexp_replace(phone, '\D', '', 'g')) between 7 and 15),
  constraint comment_len     check (comment is null or char_length(comment) <= 500)
);

-- Cola de revisión del organizador: pendientes primero, recientes arriba.
create index player_registrations_status_idx
  on player_registrations (status, created_at desc);

create trigger trg_player_registrations_updated_at
  before update on player_registrations
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table player_registrations enable row level security;

-- Cualquiera (anónimo) puede ENVIAR una inscripción, pero solo una fila "limpia":
-- status pendiente y sin campos de revisión. Así un cliente malicioso no puede
-- auto-aprobarse ni enlazar una ficha de players.
create policy "public submit registration" on player_registrations
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and created_player_id is null
    and reviewed_by is null
    and reviewed_at is null
    and review_notes is null
  );

-- El público NO puede leer la bandeja (privacidad: contiene teléfonos). Solo el
-- organizador la lee y gestiona (aprobar/rechazar).
create policy "organizer manage registrations" on player_registrations
  for all using (is_organizer()) with check (is_organizer());

-- Privilegios de tabla: anon solo inserta; el organizador (authenticated) hace todo.
grant insert on player_registrations to anon;
grant select, insert, update, delete on player_registrations to authenticated;
