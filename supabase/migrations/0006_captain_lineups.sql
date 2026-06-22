-- 0006_captain_lineups.sql
-- Permisos de capitán para alineaciones. El capitán solo toca a SU equipo.
-- El lock de 1 hora y el límite de 5 cambios ya los hacen cumplir los triggers
-- de 0002; aquí va únicamente la propiedad por equipo (RLS).
--
-- Las políticas "organizer all" (0004) ya cubren al organizador en estas tablas;
-- estas son ADITIVAS (las políticas permisivas se combinan con OR).
-- captain_team_id() es SECURITY DEFINER (0005): devuelve el team del capitán
-- actual, o NULL, sin recursión de RLS.

-- ---------------------------------------------------------------------------
-- lineups: leer / crear / editar las de su equipo
-- ---------------------------------------------------------------------------
create policy "captain read own lineups" on lineups for select
  using (team_id = captain_team_id());

create policy "captain insert own lineups" on lineups for insert
  with check (team_id = captain_team_id());

create policy "captain update own lineups" on lineups for update
  using (team_id = captain_team_id())
  with check (team_id = captain_team_id());

-- ---------------------------------------------------------------------------
-- lineup_entries: la propiedad se hereda del lineup padre
-- ---------------------------------------------------------------------------
create policy "captain read own entries" on lineup_entries for select
  using (
    exists (
      select 1 from lineups l
      where l.id = lineup_entries.lineup_id and l.team_id = captain_team_id()
    )
  );

create policy "captain insert own entries" on lineup_entries for insert
  with check (
    exists (
      select 1 from lineups l
      where l.id = lineup_entries.lineup_id and l.team_id = captain_team_id()
    )
  );

create policy "captain update own entries" on lineup_entries for update
  using (
    exists (
      select 1 from lineups l
      where l.id = lineup_entries.lineup_id and l.team_id = captain_team_id()
    )
  )
  with check (
    exists (
      select 1 from lineups l
      where l.id = lineup_entries.lineup_id and l.team_id = captain_team_id()
    )
  );

-- ---------------------------------------------------------------------------
-- lineup_change_logs: el capitán registra cambios de su equipo (el trigger
-- enforce_change_limit valida el tope de 5 por temporada).
-- ---------------------------------------------------------------------------
create policy "captain read own change logs" on lineup_change_logs for select
  using (team_id = captain_team_id());

create policy "captain insert own change logs" on lineup_change_logs for insert
  with check (team_id = captain_team_id());
