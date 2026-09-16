-- 0050_registration_v2_receipts.sql
-- Inscripción v2 para la 6a Edición femenil (plan §4.6):
--   (a) campos nuevos en player_registrations — cumpleaños, horarios que NO
--       puede jugar, comprobante de pago y su verificación;
--   (b) bucket PRIVADO 'receipts' para comprobantes (patrón tomado de
--       peak-padel: la inscrita sube; solo organizador/viewer leen);
--   (c) cupo por edición (seasons.max_players) hecho cumplir en el SERVIDOR
--       (CLAUDE.md §3.5): trigger sobre players, no solo el contador de la UI.

-- ---------------------------------------------------------------------------
-- 1. Columnas nuevas de la bandeja
--
-- blocked_time_labels: etiquetas de time_blocks que la jugadora pide NO jugar
-- ("preferentemente", igual que el formulario de la 5a edición). Se guardan
-- las ETIQUETAS ('18:30'…), no ids: es lo que la organizadora lee y lo que el
-- generador de jornadas (F6) consumirá; el subconjunto válido por edición lo
-- valida Zod contra season_time_blocks (el CHECK de aquí es solo cordura).
-- payment_verified_*: los rellena el organizador al validar el comprobante;
-- la policy de INSERT público exige que lleguen vacíos.
-- ---------------------------------------------------------------------------
alter table player_registrations
  add column if not exists birthdate            date,
  add column if not exists blocked_time_labels  text[],
  add column if not exists receipt_path         text,
  add column if not exists payment_verified_at  timestamptz,
  add column if not exists payment_verified_by  uuid references profiles(id) on delete set null;

alter table player_registrations drop constraint if exists registrations_birthdate_sane;
alter table player_registrations add constraint registrations_birthdate_sane
  check (birthdate is null or (birthdate >= date '1920-01-01' and birthdate <= now()::date));

alter table player_registrations drop constraint if exists registrations_blocked_sane;
alter table player_registrations add constraint registrations_blocked_sane
  check (blocked_time_labels is null or array_length(blocked_time_labels, 1) between 1 and 8);

-- El comprobante vive en el bucket 'receipts' bajo registrations/. Atar el
-- formato del path aquí evita que un cliente malicioso enlace rutas ajenas.
alter table player_registrations drop constraint if exists registrations_receipt_path_shape;
alter table player_registrations add constraint registrations_receipt_path_shape
  check (receipt_path is null or receipt_path ~ '^registrations/[A-Za-z0-9._-]+$');

-- ---------------------------------------------------------------------------
-- 2. La policy de INSERT público se re-crea con los campos nuevos "limpios":
--    quien se inscribe puede traer comprobante, pero jamás auto-verificarlo.
--    (Misma defensa que en 0014 para status/reviewed_*.)
-- ---------------------------------------------------------------------------
drop policy if exists "public submit registration" on player_registrations;
create policy "public submit registration" on player_registrations
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and created_player_id is null
    and reviewed_by is null
    and reviewed_at is null
    and review_notes is null
    and payment_verified_at is null
    and payment_verified_by is null
  );

-- ---------------------------------------------------------------------------
-- 3. Bucket privado de comprobantes + policies de storage
--
-- Sube ANON (la inscripción es pública y sin cuenta), lee solo el staff. El
-- costo aceptado: un bot podría subir archivos huérfanos — acotado por tamaño
-- (5 MB), tipos permitidos y bucket privado; el organizador puede purgar.
-- Un archivo queda huérfano también si la subida sale bien y el INSERT de la
-- inscripción falla después: mismo remedio (purga manual), mismo riesgo bajo.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "receipts public upload" on storage.objects;
create policy "receipts public upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'receipts' and name like 'registrations/%');

drop policy if exists "receipts staff read" on storage.objects;
create policy "receipts staff read" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (is_organizer() or is_viewer()));

drop policy if exists "receipts organizer delete" on storage.objects;
create policy "receipts organizer delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and is_organizer());

-- ---------------------------------------------------------------------------
-- 4. Cupo por edición, en el servidor
--
-- La 6a femenil está limitada a 120 (10 canchas × 3 horarios × 4). El contador
-- de la UI avisa; ESTE trigger decide. Cuenta fichas activas fuera de lista de
-- espera: aprobar de más truena aquí venga de donde venga el alta (panel,
-- import CSV o SQL). Sin candado de concurrencia a propósito: aprueba una
-- persona (el organizador); si algún día aprueban dos a la vez, el peor caso
-- es 121 y se corrige a mano — preferible a serializar todas las altas.
-- Reserve no define max_players → el trigger no le aplica.
-- ---------------------------------------------------------------------------
create or replace function enforce_season_player_cap()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_max   int;
  v_count int;
begin
  if not new.is_active or coalesce(new.is_waitlisted, false) then
    return new;
  end if;

  select max_players into v_max from seasons where id = new.season_id;
  if v_max is null then
    return new;
  end if;

  select count(*) into v_count
    from players
   where season_id = new.season_id
     and is_active
     and not coalesce(is_waitlisted, false);

  if v_count >= v_max then
    raise exception 'Cupo lleno: la edición ya tiene % fichas activas (límite %). Usa la lista de espera.',
      v_count, v_max;
  end if;

  return new;
end $$;

drop trigger if exists trg_players_season_cap on players;
create trigger trg_players_season_cap
  before insert on players
  for each row execute function enforce_season_player_cap();
