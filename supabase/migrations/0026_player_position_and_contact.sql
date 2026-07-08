-- 0026_player_position_and_contact.sql
-- Dos cosas, para que las CAPITANAS vean la posición y el teléfono de las fichas:
--
--  (A) POSICIÓN sube a players. Hasta ahora el lado de juego (drive/revés/ambas)
--      vivía SOLO en player_registrations (RLS solo-organizador), así que ni las
--      capitanas la veían ni existía para jugadores creados a mano (roster/CSV).
--      Al ser dato deportivo NO sensible, se expone en players_public: la ven
--      todos y aparece en cualquier pantalla sin trabajo extra.
--
--  (B) TELÉFONO por vista curada (players_contact). NO se puede simplemente abrir
--      players a las capitanas: la RLS es por FILA, no por COLUMNA, y verían
--      is_paid/paid_at/email. Y jamás puede ir en players_public, que lee anon.
--      Por eso una vista con columnas curadas (sin is_paid ni email), servida solo
--      a authenticated, con la AUTORIZACIÓN DENTRO del WHERE (la vista es
--      SECURITY DEFINER: corre como su dueño y salta la RLS de players, igual que
--      players_public — CLAUDE.md §5: la privacidad se hace cumplir aquí, no en la UI).
--
--      Alcance de la capitana: jugadores del POOL (sin equipo, no en lista de
--      espera) + los de SU PROPIO equipo. Nunca los de equipos rivales.

-- ---------------------------------------------------------------------------
-- (A) Posición en players + backfill desde las inscripciones aprobadas
-- ---------------------------------------------------------------------------
-- El enum player_position ya existe (0014).
alter table players add column if not exists position player_position;

update players p
set position = r.position
from player_registrations r
where r.created_player_id = p.id
  and r.status = 'approved'
  and p.position is null;

-- Vista pública: se añade `position` al final. `create or replace view` conserva
-- los grants y solo permite agregar columnas al final. Sin teléfono, como siempre.
create or replace view players_public as
select id, season_id, team_id, full_name, gender, category_code,
       is_captain, is_active, photo_url, is_waitlisted, position
from players
where is_active = true;

-- ---------------------------------------------------------------------------
-- (B) Vista de contacto: teléfono + posición para organizador y capitanas
-- ---------------------------------------------------------------------------
-- Columnas CURADAS a propósito: nada de is_paid, paid_at, paid_by, email,
-- waitlisted_at ni shirt_size. Solo lo necesario para identificar y contactar.
create or replace view players_contact as
select
  p.id,
  p.season_id,
  p.team_id,
  p.full_name,
  p.gender,
  p.category_code,
  p.photo_url,
  p.position,
  p.phone
from players p
where p.is_active
  and (
    -- El organizador ve a todos.
    is_organizer()
    -- La capitana: el pool (sin equipo y no apartados) + su propio equipo.
    or (
      captain_team_id() is not null
      and (
        (p.team_id is null and not p.is_waitlisted)
        or p.team_id = captain_team_id()
      )
    )
  );

-- Solo usuarios con sesión. anon NO debe poder leer teléfonos jamás.
-- Se revoca también a PUBLIC: Supabase tiene default privileges que pueden otorgar
-- SELECT a anon/authenticated en objetos nuevos del schema public.
revoke all on players_contact from public;
revoke all on players_contact from anon;
grant select on players_contact to authenticated;
