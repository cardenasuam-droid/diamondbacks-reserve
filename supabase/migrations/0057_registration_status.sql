-- 0057_registration_status.sql
-- "Mi inscripción" para las jugadoras (pedido del organizador, 2026-09-17):
-- tras inscribirse pueden CONFIRMAR que quedaron registradas y subir el
-- comprobante después si no lo hicieron al enviar (equivalente al perfil del
-- torneo de Peak, pero con ENLACE MÁGICO en lugar de PIN).
--
-- Mecanismo: el propio formulario genera un token secreto (uuid) y lo manda
-- en el INSERT; ese token ES la credencial de la inscripción. Va guardado en
-- el dispositivo y en un enlace copiable. Dos RPCs SECURITY DEFINER lo
-- consumen: una devuelve el ESTADO (datos de confirmación, nunca teléfono ni
-- cumpleaños: un enlace compartido no debe filtrar datos privados) y la otra
-- adjunta/reemplaza comprobantes mientras el pago NO esté verificado. La
-- bandeja sigue sin lectura pública; anon no gana ningún SELECT.

alter table player_registrations
  add column if not exists access_token uuid not null default gen_random_uuid();

create unique index if not exists player_registrations_access_token
  on player_registrations (access_token);

-- Estado de una inscripción por token. Solo datos de confirmación.
create or replace function registration_status(p_token uuid)
returns table (
  full_name               text,
  requested_category_code text,
  status                  registration_status,
  season_id               uuid,
  created_at              timestamptz,
  has_receipt             boolean,
  has_discount_receipt    boolean,
  payment_verified        boolean
)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.full_name,
         r.requested_category_code,
         r.status,
         r.season_id,
         r.created_at,
         r.receipt_path is not null,
         r.discount_receipt_path is not null,
         r.payment_verified_at is not null
    from player_registrations r
   where r.access_token = p_token
   limit 1;
$$;

grant execute on function registration_status(uuid) to anon, authenticated;

-- Adjuntar (o reemplazar) un comprobante después de inscribirse. El archivo
-- ya vive en el bucket privado 'receipts' (la policy de subida de 0050 lo
-- permite); aquí solo se enlaza a la inscripción del token. Con el pago ya
-- verificado se bloquea: ese comprobante respalda un lugar apartado.
create or replace function attach_registration_receipt(
  p_token uuid,
  p_kind  text,   -- 'payment' | 'discount'
  p_path  text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r player_registrations%rowtype;
begin
  if p_kind not in ('payment', 'discount') then
    raise exception 'Tipo de comprobante no válido.';
  end if;
  if p_path is null or p_path !~ '^registrations/[A-Za-z0-9._-]+$' then
    raise exception 'Ruta de comprobante no válida.';
  end if;

  select * into r from player_registrations where access_token = p_token;
  if not found then
    raise exception 'Inscripción no encontrada.';
  end if;
  if r.status = 'rejected' then
    raise exception 'Esta inscripción fue rechazada; contacta a la organizadora.';
  end if;
  if r.payment_verified_at is not null then
    raise exception 'Tu pago ya fue confirmado: no hace falta cambiar el comprobante.';
  end if;

  if p_kind = 'payment' then
    update player_registrations set receipt_path = p_path where id = r.id;
  else
    update player_registrations set discount_receipt_path = p_path where id = r.id;
  end if;
end $$;

grant execute on function attach_registration_receipt(uuid, text, text) to anon, authenticated;
