-- 0008_password_auth.sql
-- Cambia el login: de OTP por email a "elige tu nombre + contraseña", con
-- verificación por los ÚLTIMOS 4 DÍGITOS del teléfono del roster.
-- (Reemplaza la decisión de CLAUDE.md §3.3.)
--
-- El email de Supabase Auth es SINTÉTICO, derivado del player_id público
-- (<player_id>@players.local): el jugador nunca ve ni escribe un email. El
-- teléfono se valida en el servidor; nunca se expone al cliente.
--
-- Requiere en el panel de Supabase: Authentication → Providers → Email ON y
-- "Confirm email" OFF (para que el alta entre con sesión al instante, sin correo).

-- Un solo perfil por ficha de jugador (no se puede reclamar dos veces).
create unique index if not exists one_profile_per_player
  on profiles (player_id) where player_id is not null;

-- Últimos 4 dígitos de un teléfono, ignorando espacios, guiones, etc.
create or replace function digits_last4(p text)
returns text language sql immutable as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 4);
$$;

-- ¿Ese jugador ya tiene cuenta? La UI decide entre registro y login.
create or replace function player_has_account(p_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where player_id = p_player_id);
$$;
grant execute on function player_has_account(uuid) to anon, authenticated;

-- Verifica el reclamo y da una razón legible para la UI. El trigger la repite
-- como candado real (un cliente podría saltarse esta RPC).
create or replace function verify_player_claim(p_player_id uuid, p_phone_last4 text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl players%rowtype;
begin
  select * into pl from players where id = p_player_id and is_active = true;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if exists (select 1 from profiles where player_id = p_player_id) then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed');
  end if;
  if digits_last4(pl.phone) = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_phone');
  end if;
  if digits_last4(pl.phone) <> digits_last4(p_phone_last4) then
    return jsonb_build_object('ok', false, 'reason', 'wrong_phone');
  end if;
  return jsonb_build_object('ok', true, 'reason', 'ok');
end;
$$;
grant execute on function verify_player_claim(uuid, text) to anon, authenticated;

-- Reescribe el enlace de cuenta. Dos caminos:
--   (1) auto-registro de jugador (metadata trae player_id): verifica teléfono,
--       que no esté reclamado, enlaza y deriva el rol. Lanza si algo falla.
--   (2) cuenta de staff (sin player_id; creada en el panel de Supabase): crea
--       un profile simple con rol 'player' (el organizador lo sube a 'organizer').
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pid   uuid;
  v_last4 text;
  pl      players%rowtype;
  v_role  user_role := 'player';
begin
  v_pid := nullif(new.raw_user_meta_data->>'player_id', '')::uuid;

  -- (2) staff / admin sin ficha de jugador.
  if v_pid is null then
    insert into profiles (id, email, full_name, role)
    values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'player')
    on conflict (id) do nothing;
    return new;
  end if;

  -- (1) auto-registro de jugador.
  select * into pl from players where id = v_pid and is_active = true;
  if not found then
    raise exception 'Jugador no encontrado.';
  end if;
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

  if pl.is_captain then
    v_role := 'captain';
  end if;

  insert into profiles (id, email, full_name, role, player_id)
  values (new.id, new.email, pl.full_name, v_role, pl.id)
  on conflict (id) do nothing;

  return new;
end;
$$;
