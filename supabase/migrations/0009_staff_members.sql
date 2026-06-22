-- 0009_staff_members.sql
-- Lista semilla de staff (organizador, web manager, …) para el PRIMER acceso,
-- antes de que existan jugadores en el roster. El staff entra con el MISMO
-- mecanismo que los jugadores (elegir nombre + contraseña), pero su verificación
-- de primer acceso es un CÓDIGO por persona (no tiene teléfono en el roster).
--
-- Bootstrap: inserta tu fila a mano para arrancar, p. ej.:
--   insert into staff_members (full_name, role, access_code)
--   values ('Tu Nombre', 'organizer', 'ELIGE-UN-CODIGO');
-- Después, desde el panel se podrá cargar la lista completa.

create table if not exists staff_members (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  role        user_role not null default 'organizer',
  access_code text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table staff_members enable row level security;
-- Solo el organizador gestiona la lista de staff. El público NUNCA lee la tabla
-- cruda (el código es secreto); usa la vista staff_public y las RPCs.
create policy "organizer manage staff" on staff_members for all
  using (is_organizer()) with check (is_organizer());

-- Vista pública SIN el código: alimenta el selector de nombres.
create or replace view staff_public as
  select id, full_name, role from staff_members where is_active = true;
grant select on staff_public to anon, authenticated;

-- Enlace de la cuenta al staff + candado anti-doble-reclamo.
alter table profiles
  add column if not exists staff_member_id uuid references staff_members(id) on delete set null;
create unique index if not exists one_profile_per_staff
  on profiles (staff_member_id) where staff_member_id is not null;

-- ¿Ese staff ya tiene cuenta? (la UI decide registro vs login)
create or replace function staff_has_account(p_staff_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where staff_member_id = p_staff_id);
$$;
grant execute on function staff_has_account(uuid) to anon, authenticated;

-- Verifica el código (mensaje claro para la UI). El trigger lo repite como candado.
create or replace function verify_staff_claim(p_staff_id uuid, p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare st staff_members%rowtype;
begin
  select * into st from staff_members where id = p_staff_id and is_active = true;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if exists (select 1 from profiles where staff_member_id = p_staff_id) then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed');
  end if;
  if coalesce(trim(st.access_code), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_code');
  end if;
  if trim(st.access_code) <> trim(coalesce(p_code, '')) then
    return jsonb_build_object('ok', false, 'reason', 'wrong_code');
  end if;
  return jsonb_build_object('ok', true, 'reason', 'ok');
end;
$$;
grant execute on function verify_staff_claim(uuid, text) to anon, authenticated;

-- Reescribe el enlace de cuenta con TRES caminos (jugador / staff / correo).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pid   uuid;
  v_sid   uuid;
  v_last4 text;
  v_code  text;
  pl      players%rowtype;
  st      staff_members%rowtype;
  v_role  user_role := 'player';
begin
  v_pid := nullif(new.raw_user_meta_data->>'player_id', '')::uuid;
  v_sid := nullif(new.raw_user_meta_data->>'staff_id', '')::uuid;

  -- (A) Jugador: metadata trae player_id → verifica teléfono.
  if v_pid is not null then
    select * into pl from players where id = v_pid and is_active = true;
    if not found then raise exception 'Jugador no encontrado.'; end if;
    if exists (select 1 from profiles where player_id = v_pid) then
      raise exception 'Este jugador ya tiene cuenta.';
    end if;
    if digits_last4(pl.phone) = '' then
      raise exception 'Este jugador no tiene teléfono registrado; pide acceso al organizador.';
    end if;
    v_last4 := new.raw_user_meta_data->>'phone_last4';
    if digits_last4(pl.phone) <> digits_last4(v_last4) then
      raise exception 'Los últimos 4 dígitos del teléfono no coinciden.';
    end if;
    if pl.is_captain then v_role := 'captain'; end if;
    insert into profiles (id, email, full_name, role, player_id)
    values (new.id, new.email, pl.full_name, v_role, pl.id)
    on conflict (id) do nothing;
    return new;
  end if;

  -- (B) Staff de la lista: metadata trae staff_id → verifica código.
  if v_sid is not null then
    select * into st from staff_members where id = v_sid and is_active = true;
    if not found then raise exception 'Acceso de staff no encontrado.'; end if;
    if exists (select 1 from profiles where staff_member_id = v_sid) then
      raise exception 'Este acceso ya fue usado.';
    end if;
    v_code := new.raw_user_meta_data->>'access_code';
    if coalesce(trim(st.access_code), '') = '' then
      raise exception 'Este acceso no tiene código configurado.';
    end if;
    if trim(st.access_code) <> trim(coalesce(v_code, '')) then
      raise exception 'Código de acceso incorrecto.';
    end if;
    insert into profiles (id, email, full_name, role, staff_member_id)
    values (new.id, new.email, st.full_name, st.role, st.id)
    on conflict (id) do nothing;
    return new;
  end if;

  -- (C) Cuenta de correo (respaldo creado en el panel de Supabase).
  insert into profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'player')
  on conflict (id) do nothing;
  return new;
end;
$$;
