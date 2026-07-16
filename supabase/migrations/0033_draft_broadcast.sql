-- 0033_draft_broadcast.sql
-- Escala el draft en vivo: reemplaza el transporte postgres_changes por Realtime
-- BROADCAST DESDE LA BASE DE DATOS.
--
-- Por qué: postgres_changes reevalúa las políticas RLS por CADA conexión y
-- reenvía cada cambio a todos los suscriptores. No escala con espectadores: en un
-- draft con mucha gente conectada, los eventos se retrasan/pierden y los picks
-- tardan en verse (o no se ven). Broadcast emite UN mensaje por evento a un topic
-- ('draft:<draft_id>') y Realtime lo reparte sin reevaluar RLS por conexión.
--
-- ⚠️ DESPLIEGUE ACOPLADO: aplica esta migración JUNTO con el cambio de cliente
--    (src/features/draft/useDraftRealtime.ts → broadcast). Si se despliega solo
--    uno de los dos, el draft en vivo se queda sin actualizaciones.
--
-- Nota: las tablas siguen en la publicación supabase_realtime (0015/0028). Es
-- inofensivo: sin suscriptores de postgres_changes no hay fan-out. Se deja para
-- permitir un rollback simple del cliente. Se puede limpiar en una migración
-- posterior una vez validado el broadcast en un draft real.

-- ---------------------------------------------------------------------------
-- Trigger: por cada cambio en drafts / draft_picks / draft_category_orders,
-- emite un broadcast al topic del draft con la fila cambiada (record/old).
-- ---------------------------------------------------------------------------
create or replace function public.tg_broadcast_draft()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
declare
  v_draft_id uuid;
  v_new jsonb := case when TG_OP <> 'DELETE' then to_jsonb(NEW) else null end;
  v_old jsonb := case when TG_OP <> 'INSERT' then to_jsonb(OLD) else null end;
begin
  -- El id del draft vive en 'id' (tabla drafts) o en 'draft_id' (las otras dos).
  v_draft_id := coalesce(
    (v_new->>'draft_id')::uuid, (v_old->>'draft_id')::uuid,
    (v_new->>'id')::uuid,       (v_old->>'id')::uuid
  );
  if v_draft_id is null then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'op',     TG_OP,
      'table',  TG_TABLE_NAME,
      'record', v_new,
      'old',    v_old
    ),
    'draft_change',                 -- event name (el cliente escucha este)
    'draft:' || v_draft_id::text,   -- topic
    true                            -- private: exige autorización RLS al recibir
  );
  return null;
end;
$$;

-- Nadie la invoca directo; solo se dispara como trigger (owner = definer).
revoke all on function public.tg_broadcast_draft() from public, anon, authenticated;

drop trigger if exists trg_broadcast_draft on drafts;
create trigger trg_broadcast_draft after insert or update or delete on drafts
  for each row execute function public.tg_broadcast_draft();

drop trigger if exists trg_broadcast_draft on draft_picks;
create trigger trg_broadcast_draft after insert or update or delete on draft_picks
  for each row execute function public.tg_broadcast_draft();

drop trigger if exists trg_broadcast_draft on draft_category_orders;
create trigger trg_broadcast_draft after insert or update or delete on draft_category_orders
  for each row execute function public.tg_broadcast_draft();

-- ---------------------------------------------------------------------------
-- Autorización de Broadcast: permitir RECIBIR (select sobre realtime.messages)
-- los mensajes de cualquier topic 'draft:%' a anon y authenticated. Todo el board
-- del draft ya es público (RLS using(true) en 0015/0028), así que exponerlo por
-- broadcast es consistente. El INSERT del mensaje lo hace el trigger (definer),
-- no el cliente, por eso solo se necesita política de SELECT.
-- ---------------------------------------------------------------------------
drop policy if exists "receive draft broadcasts" on realtime.messages;
create policy "receive draft broadcasts"
on realtime.messages
for select
to anon, authenticated
using ( realtime.topic() like 'draft:%' );
