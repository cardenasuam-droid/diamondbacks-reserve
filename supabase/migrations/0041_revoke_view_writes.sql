-- 0041_revoke_view_writes.sql
-- Cierra la escritura pública a través de las vistas. [CRÍTICO — Fase 0.1 del
-- diagnóstico 2026-07-20]
--
-- EL AGUJERO. Las vistas de public nacieron heredando los default privileges del
-- rol postgres en Supabase: TODOS los privilegios (arwdDxtm) para anon y
-- authenticated. Verificado en vivo el 2026-07-20: has_table_privilege('anon',
-- 'players_public', 'INSERT'/'UPDATE'/'DELETE') = true. Como una vista simple es
-- AUTO-ACTUALIZABLE y ejecuta con los permisos de su dueño (postgres), escribir a
-- través de ella SE SALTA LA RLS de la tabla base: cualquiera con el anon key
-- (que viaja en el frontend) podía insertar, modificar o borrar los 183 jugadores
-- (players_public), el staff (staff_public) y, con cualquier sesión, players vía
-- players_contact. Las 4 vistas agregadas (standings/rankings/h2h/per_team_match)
-- no son actualizables y rechazaban la escritura por estructura, pero llevaban el
-- mismo ACL: se cierran igual por si una refactorización futura las simplifica.
--
-- POR QUÉ PASÓ. `create or replace view` CONSERVA el ACL existente: cada
-- recreación (0026, 0034, 0039) arrastró los grants heredados de la creación
-- original. La 0039 revocó los default privileges de sus TABLAS nuevas (patrón
-- correcto) pero no lo aplicó a la vista que recreó. Este archivo salda esa deuda
-- para las 7 vistas de una vez.
--
-- POR QUÉ NO security_invoker: players_public y staff_public EXISTEN para exponer
-- columnas curadas a anon saltándose la RLS de la tabla base (que no tiene
-- política de lectura anónima) — con security_invoker devolverían 0 filas y
-- romperían la app. players_contact autoriza DENTRO de su WHERE por diseño
-- (0027). El alcance correcto aquí son los GRANTS: lectura sí, escritura jamás.
--
-- ⚠️ REGLA PARA EL FUTURO: `create or replace view` conserva este ACL cerrado,
-- pero un DROP VIEW + CREATE VIEW vuelve a heredar los default privileges y
-- REABRE el agujero. Si alguna migración futura necesita DROP+CREATE de una
-- vista, debe repetir el revoke. Comprobación rápida tras cualquier cambio de
-- vistas (debe dar false en todo):
--   select relname, has_table_privilege('anon', oid, 'INSERT')
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind = 'v';

-- 1. Fuera TODO privilegio de anon/authenticated/public sobre las 7 vistas.
--    (El rol de solo lectura diz_garcia=r no se toca; service_role tampoco —
--    no pasa por PostgREST con claves del cliente.)
revoke all on
  public.players_public,
  public.staff_public,
  public.players_contact,
  public.per_team_match,
  public.team_standings,
  public.player_rankings,
  public.head_to_head
from public, anon, authenticated;

-- 2. Se devuelve EXACTAMENTE la lectura que cada vista tenía y necesita:
--    - players_public / staff_public: públicas (roster y selector de login).
--    - standings / rankings / h2h / per_team_match: públicas (0004).
--    - players_contact: SOLO authenticated (teléfonos; la autorización fina va
--      dentro del WHERE de la vista, 0027). anon NO recupera el select que
--      tampoco tenía.
grant select on
  public.players_public,
  public.staff_public,
  public.per_team_match,
  public.team_standings,
  public.player_rankings,
  public.head_to_head
to anon, authenticated;

grant select on public.players_contact to authenticated;
