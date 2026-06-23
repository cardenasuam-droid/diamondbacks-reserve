-- 0012_player_photo.sql
-- Foto del jugador (URL en el bucket público 'media'). Opcional. La sube el
-- organizador desde la gestión de roster (MediaField → uploadMedia).

alter table players add column if not exists photo_url text;

-- Re-exponer la vista pública incluyendo la foto. `create or replace view`
-- conserva los grants existentes (anon/authenticated) y solo añade la columna
-- al final, manteniendo el resto idéntico.
create or replace view players_public as
select id, season_id, team_id, full_name, gender, category_code,
       is_captain, is_active, photo_url
from players
where is_active = true;
