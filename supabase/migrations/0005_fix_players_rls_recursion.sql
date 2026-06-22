-- 0005_fix_players_rls_recursion.sql
-- Arregla "infinite recursion detected in policy for relation players" (42P17).
--
-- Causa: la política "players self read" (0004) consultaba la propia tabla
-- players dentro de su USING (rama del capitán: join players me ...), por lo que
-- la política se reaplicaba a sí misma → recursión. Rompía TODA lectura de
-- players (jugador, capitán y organizador).
--
-- Solución: mover las lecturas de players a funciones SECURITY DEFINER (como el
-- patrón ya usado por is_organizer()), que se ejecutan con privilegios del dueño
-- y omiten RLS, de modo que la política deja de auto-referenciarse.

-- player_id del usuario actual (vía su profile). NULL si no hay sesión/enlace.
create or replace function current_player_id()
returns uuid language sql stable security definer set search_path = public as $$
  select player_id from profiles where id = auth.uid() limit 1;
$$;

-- team_id del que el usuario actual es capitán. NULL si no es capitán.
create or replace function captain_team_id()
returns uuid language sql stable security definer set search_path = public as $$
  select me.team_id
  from profiles pr
  join players me on me.id = pr.player_id
  where pr.id = auth.uid() and me.is_captain = true
  limit 1;
$$;

-- Reescribe la política sin tocar la tabla players dentro de sí misma.
drop policy if exists "players self read" on players;
create policy "players self read" on players for select
  using (
    is_organizer()                          -- organizador: todo
    or players.id = current_player_id()      -- el propio jugador: su ficha
    or players.team_id = captain_team_id()   -- capitán: jugadores de su equipo
  );
