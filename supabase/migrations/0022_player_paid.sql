-- 0022_player_paid.sql
-- Estado de pago de inscripción por jugador. Lo usan los organizadores para saber
-- quién ya pagó su inscripción a la liga. Aplica a CUALQUIER jugador de la ficha
-- (players), incluidos los del POOL (team_id null): al vivir en players, cubre
-- inscritos, asignados y free agents con una sola columna.
--
-- Privacidad (CLAUDE.md §5): NO se expone en players_public, así el público y las
-- capitanas nunca lo ven. Escritura restringida al organizador por la RLS
-- "organizer all" de players (0004): jugadores y capitanes NO tienen ninguna
-- política de UPDATE sobre players, así que no pueden marcarse como pagados. El
-- rol 'viewer' (admin de solo lectura) lo LEE por "viewer read" (0020) pero no
-- puede escribir. Mismo patrón que shirt_size (0017): dato administrativo/privado
-- que vive en players y se mantiene fuera de la vista pública.

-- ---------------------------------------------------------------------------
-- Columna + trazabilidad (quién marcó y cuándo)
-- ---------------------------------------------------------------------------
alter table players
  add column if not exists is_paid boolean not null default false,
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by uuid references profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Auditoría automática: al cambiar is_paid, sella paid_at/paid_by en el SERVIDOR
-- (no se confía del cliente). Marcar como pagado registra ahora + el usuario
-- actual; desmarcar limpia ambos. Corre junto al trigger de updated_at (0001).
-- ---------------------------------------------------------------------------
create or replace function set_player_paid_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- En INSERT, old es null → is distinct from cubre el alta "ya pagado".
  if new.is_paid is distinct from (case when tg_op = 'UPDATE' then old.is_paid else null end) then
    if new.is_paid then
      new.paid_at := now();
      new.paid_by := auth.uid();
    else
      new.paid_at := null;
      new.paid_by := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_players_paid_audit on players;
create trigger trg_players_paid_audit
  before insert or update on players
  for each row execute function set_player_paid_audit();

-- No se toca players_public (0004): la vista sigue exponiendo solo columnas
-- deportivas públicas, sin is_paid. La RLS existente (organizer all / viewer read)
-- ya gobierna quién lee y escribe la columna; no hacen falta políticas nuevas.
