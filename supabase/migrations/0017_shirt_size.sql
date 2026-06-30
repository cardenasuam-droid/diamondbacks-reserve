-- 0017_shirt_size.sql
-- Talla de playera (XS–XXL) del jugador. Opcional: la pide el registro, y quien
-- ya se inscribió antes puede ponerla desde "Mi cuenta" (RPC self-service) o el
-- organizador desde el roster/pool. Se guarda en players (fuente de verdad) y en
-- player_registrations (lo que pidió al inscribirse).
--
-- PRIVACIDAD: la talla NO se expone en la vista pública players_public. Se lee
-- desde la tabla players, cuya RLS ("players self read", 0004) ya la limita a: el
-- propio jugador, el capitán de su equipo y el organizador. El resto no la ve.

-- (1) Tipo enumerado de tallas. Idempotente.
do $$ begin
  create type shirt_size as enum ('XS', 'S', 'M', 'L', 'XL', 'XXL');
exception when duplicate_object then null; end $$;

-- (2) Columnas (nullable: los jugadores/inscripciones previos no la tienen).
alter table players              add column if not exists shirt_size shirt_size;
alter table player_registrations add column if not exists shirt_size shirt_size;

-- (3) Self-service: el propio jugador fija SU talla desde "Mi cuenta", sin abrir
-- un UPDATE general sobre players (SECURITY DEFINER, como set_my_photo en 0013).
-- Param text + cast a enum: valida el valor y evita ambigüedad en PostgREST.
create or replace function set_my_shirt_size(p_size text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_player_id() is null then
    raise exception 'Tu cuenta no está enlazada a una ficha de jugador.';
  end if;
  update players set shirt_size = p_size::shirt_size, updated_at = now()
    where id = current_player_id();
end;
$$;
grant execute on function set_my_shirt_size(text) to authenticated;
