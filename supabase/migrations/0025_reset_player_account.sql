-- 0025_reset_player_account.sql
-- El organizador puede REINICIAR el acceso de un jugador: se borra su cuenta de
-- Supabase Auth y, al no existir cuenta para esa ficha, la app lo regresa al
-- "primer acceso" (elegir nombre → últimos 4 dígitos del teléfono → nueva
-- contraseña). NO se toca nada deportivo: players/alineaciones/resultados/ranking
-- dependen de players, no de la cuenta.
--
-- Requisito: al borrar el profile (cascada de auth.users) los campos de auditoría
-- que lo referencian deben ANULARSE, no bloquear el borrado. Se ablandan esas FKs
-- a ON DELETE SET NULL (draft_picks.picked_by y player_registrations.reviewed_by
-- ya lo eran). Perder el "quién hizo esta acción" es aceptable; conservar la
-- integridad del reinicio, no.

-- ---------------------------------------------------------------------------
-- FKs de auditoría → ON DELETE SET NULL (idempotente)
-- ---------------------------------------------------------------------------
alter table lineups            drop constraint if exists lineups_submitted_by_fkey;
alter table lineups            add  constraint lineups_submitted_by_fkey
  foreign key (submitted_by) references profiles(id) on delete set null;

alter table lineup_change_logs drop constraint if exists lineup_change_logs_changed_by_fkey;
alter table lineup_change_logs add  constraint lineup_change_logs_changed_by_fkey
  foreign key (changed_by) references profiles(id) on delete set null;

alter table match_results      drop constraint if exists match_results_reported_by_fkey;
alter table match_results      add  constraint match_results_reported_by_fkey
  foreign key (reported_by) references profiles(id) on delete set null;

alter table match_results      drop constraint if exists match_results_validated_by_fkey;
alter table match_results      add  constraint match_results_validated_by_fkey
  foreign key (validated_by) references profiles(id) on delete set null;

alter table news_posts         drop constraint if exists news_posts_created_by_fkey;
alter table news_posts         add  constraint news_posts_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table league_documents   drop constraint if exists league_documents_uploaded_by_fkey;
alter table league_documents   add  constraint league_documents_uploaded_by_fkey
  foreign key (uploaded_by) references profiles(id) on delete set null;

alter table notifications      drop constraint if exists notifications_created_by_fkey;
alter table notifications      add  constraint notifications_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table notifications      drop constraint if exists notifications_target_user_id_fkey;
alter table notifications      add  constraint notifications_target_user_id_fkey
  foreign key (target_user_id) references profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- RPC: reiniciar el acceso de un jugador (solo organizador).
-- SECURITY DEFINER (dueño = postgres, puede borrar en auth.users). is_organizer()
-- se evalúa sobre el usuario que LLAMA (auth.uid() lee el JWT, no el dueño).
-- ---------------------------------------------------------------------------
create or replace function reset_player_account(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if not is_organizer() then
    raise exception 'Solo el organizador puede reiniciar contraseñas.';
  end if;

  select id into v_uid from profiles where player_id = p_player_id;
  if v_uid is null then
    -- No tiene cuenta: ya está en el paso inicial, nada que reiniciar.
    return jsonb_build_object('ok', true, 'reason', 'no_account');
  end if;

  -- Borra la cuenta de Auth (cascada borra el profile; auth.identities/sessions
  -- se limpian por las cascadas de GoTrue). Los campos de auditoría → null.
  delete from auth.users where id = v_uid;

  -- Limpia el rate-limit del reclamo para que pueda re-verificar de inmediato.
  delete from claim_attempts where target_id = p_player_id and kind = 'player';

  return jsonb_build_object('ok', true, 'reason', 'reset');
end $$;

grant execute on function reset_player_account(uuid) to authenticated;
