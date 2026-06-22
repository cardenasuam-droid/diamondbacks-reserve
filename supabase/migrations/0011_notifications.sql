-- 0011_notifications.sql
-- Avisos internos: lectura para el destinatario (por rol, equipo, usuario o
-- difusión general) y escritura para gestores de contenido (organizador/web
-- manager). Comparten por WhatsApp desde el cliente (sin tabla extra).

-- Equipo del usuario actual (vía su ficha de jugador). NULL si no es jugador.
create or replace function current_team_id()
returns uuid language sql stable security definer set search_path = public as $$
  select pl.team_id
  from profiles pr
  join players pl on pl.id = pr.player_id
  where pr.id = auth.uid()
  limit 1;
$$;

-- Lectura: el aviso es visible si es difusión general, o va dirigido a mi
-- usuario, a mi rol o a mi equipo. Los gestores ven todos.
create policy "read my notifications" on notifications for select
  using (
    is_content_manager()
    or (target_role is null and target_team_id is null and target_user_id is null)
    or target_user_id = auth.uid()
    or target_role = (select role from profiles where id = auth.uid())
    or target_team_id = current_team_id()
  );

-- Escritura: gestores de contenido (el organizador ya tiene "organizer all").
create policy "content manage notifications" on notifications for all
  using (is_content_manager()) with check (is_content_manager());
