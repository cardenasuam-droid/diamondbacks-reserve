-- 0027_viewer_contact_access.sql
-- El rol 'viewer' (admin de SOLO LECTURA, 0019/0020) debe tener el mismo alcance
-- de lectura que el organizador — incluidos los datos privados de las fichas, como
-- dice el encabezado de 0020. La vista players_contact (0026) se creó antes de que
-- el rol existiera en la BD, así que no lo contemplaba y el observador no veía
-- teléfonos. Aquí se añade `is_viewer()` a la autorización.
--
-- REQUISITO: correr DESPUÉS de 0019 y 0020 (necesita la función is_viewer()).
-- Sigue siendo SOLO LECTURA: el observador no tiene ninguna política de escritura.

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
    -- Organizador y observador (solo lectura) ven a todos.
    is_organizer()
    or is_viewer()
    -- La capitana: el pool (sin equipo y no apartados) + su propio equipo.
    or (
      captain_team_id() is not null
      and (
        (p.team_id is null and not p.is_waitlisted)
        or p.team_id = captain_team_id()
      )
    )
  );

-- `create or replace view` conserva los grants, pero se re-afirman por claridad:
-- anon JAMÁS lee teléfonos.
revoke all on players_contact from public;
revoke all on players_contact from anon;
grant select on players_contact to authenticated;
