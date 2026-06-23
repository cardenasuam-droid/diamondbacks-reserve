-- 0013_player_self_photo.sql
-- Permite que un JUGADOR suba/cambie SU PROPIA foto desde "Mi cuenta",
-- sin esperar a que el organizador la cargue.

-- (1) Storage: además de los gestores de contenido (0010), cualquier usuario
-- autenticado puede subir a la carpeta 'players/' del bucket público 'media'
-- (ahí van las fotos de perfil). El resto del bucket sigue restringido.
drop policy if exists "players upload own photo" on storage.objects;
create policy "players upload own photo" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'players');

-- (2) RPC: actualiza SOLO photo_url de la ficha enlazada al usuario actual.
-- SECURITY DEFINER para no abrir un UPDATE general sobre players (que dejaría
-- cambiar nombre/categoría); solo toca la foto de su propia ficha.
create or replace function set_my_photo(p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_player_id() is null then
    raise exception 'Tu cuenta no está enlazada a una ficha de jugador.';
  end if;
  update players
    set photo_url = nullif(trim(p_url), ''), updated_at = now()
    where id = current_player_id();
end;
$$;
grant execute on function set_my_photo(text) to authenticated;
