-- 0018_security_hardening.sql
-- Endurecimiento de seguridad tras la auditoría del 2026-07-01
-- (ver docs/auditoria-seguridad-2026-07-01.md). Una sola migración con seis
-- arreglos, del más grave al menos:
--
--   [CRÍTICO] Escalada de privilegios: un jugador podía auto-asignarse
--             role='organizer' con un UPDATE a su propio profile. Se bloquea por
--             columna (authenticated solo puede tocar full_name).
--   [HIGH]    access_code de staff en claro → se hashea con pgcrypto (bcrypt).
--   [HIGH]    Reclamo de cuenta sin límite (fuerza bruta de los 4 dígitos del
--             teléfono y del código) → rate-limit por objetivo (claim_attempts).
--   [MEDIUM]  Evasión del tope de 5 cambios: el capitán escribía lineup_entries
--             directo sin registrar el log → se revoca la escritura directa y
--             save_lineup pasa a SECURITY DEFINER (única puerta + advisory lock).
--   [MEDIUM]  Bucket 'media' sin restricción de tipo/tamaño (XSS por SVG/HTML) y
--             subida no ligada a identidad → allowed_mime_types + file_size_limit
--             y la foto se sube a players/<uid>/.
--   [MEDIUM]  El reloj del draft no se hacía cumplir en el servidor → make_pick
--             rechaza (y auto-selecciona) cuando el turno ya venció.

create extension if not exists pgcrypto with schema extensions;

-- ===========================================================================
-- [CRÍTICO] profiles: congelar columnas sensibles frente al cliente.
-- La política RLS "profiles self update" (0004) ya limita la FILA (id=auth.uid())
-- pero RLS no filtra COLUMNAS: sin esto, un UPDATE podía cambiar role/player_id.
-- Los cambios legítimos de rol los hacen triggers SECURITY DEFINER
-- (handle_new_user, sync_captain_role) que corren como dueño y omiten estos GRANT.
-- ===========================================================================
revoke update on profiles from anon, authenticated;
grant update (full_name) on profiles to authenticated;

-- ===========================================================================
-- [HIGH] access_code de staff hasheado (bcrypt). Trigger transparente: hashea el
-- código en claro al insertarlo/cambiarlo, salvo que ya venga hasheado.
-- ===========================================================================
create or replace function hash_staff_access_code()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.access_code is not null and btrim(new.access_code) <> ''
     and new.access_code !~ '^\$2[aby]\$' then
    new.access_code := crypt(btrim(new.access_code), gen_salt('bf'));
  end if;
  return new;
end $$;

drop trigger if exists trg_hash_staff_code on staff_members;
create trigger trg_hash_staff_code
  before insert or update of access_code on staff_members
  for each row execute function hash_staff_access_code();

-- Hashea cualquier código en claro que ya existiera (el trigger lo transforma).
update staff_members set access_code = btrim(access_code)
  where access_code is not null and access_code !~ '^\$2[aby]\$';

-- ===========================================================================
-- [HIGH] Rate-limit del reclamo (contra fuerza bruta de teléfono/código).
-- Tabla de intentos por objetivo; sin políticas RLS → inaccesible al cliente,
-- solo la usan las funciones DEFINER (dueño).
-- ===========================================================================
create table if not exists claim_attempts (
  id           bigint generated always as identity primary key,
  target_id    uuid not null,
  kind         text not null check (kind in ('player','staff')),
  attempted_at timestamptz not null default now()
);
create index if not exists idx_claim_attempts_lookup
  on claim_attempts (target_id, attempted_at);
alter table claim_attempts enable row level security;

-- Registra un intento y lanza (errcode PT429) si hay demasiados en la ventana.
-- Máx 8 intentos por objetivo en 15 min: fuerza bruta de 10^4 pasa de segundos
-- a semanas, y combinado con el rate-limit de Supabase Auth, deja de ser viable.
create or replace function register_claim_attempt(p_target uuid, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare v_recent int;
begin
  delete from claim_attempts where attempted_at < now() - interval '1 hour';
  select count(*) into v_recent from claim_attempts
   where target_id = p_target and attempted_at > now() - interval '15 minutes';
  if v_recent >= 8 then
    raise exception 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
      using errcode = 'PT429';
  end if;
  insert into claim_attempts (target_id, kind) values (p_target, p_kind);
end $$;
-- No se concede execute a anon/authenticated: solo se llama desde funciones DEFINER.

-- verify_player_claim: ahora VOLATILE (registra intentos) y con throttling antes
-- de comparar el teléfono. Devuelve reason='rate_limited' de forma limpia.
create or replace function verify_player_claim(p_player_id uuid, p_phone_last4 text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
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
  begin
    perform register_claim_attempt(p_player_id, 'player');
  exception when sqlstate 'PT429' then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end;
  if digits_last4(pl.phone) <> digits_last4(p_phone_last4) then
    return jsonb_build_object('ok', false, 'reason', 'wrong_phone');
  end if;
  return jsonb_build_object('ok', true, 'reason', 'ok');
end;
$$;
grant execute on function verify_player_claim(uuid, text) to anon, authenticated;

-- verify_staff_claim: throttling + comparación del código HASHEADO (crypt).
create or replace function verify_staff_claim(p_staff_id uuid, p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare st staff_members%rowtype;
begin
  select * into st from staff_members where id = p_staff_id and is_active = true;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if exists (select 1 from profiles where staff_member_id = p_staff_id) then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed');
  end if;
  if coalesce(btrim(st.access_code), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_code');
  end if;
  begin
    perform register_claim_attempt(p_staff_id, 'staff');
  exception when sqlstate 'PT429' then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end;
  if st.access_code <> crypt(btrim(coalesce(p_code, '')), st.access_code) then
    return jsonb_build_object('ok', false, 'reason', 'wrong_code');
  end if;
  return jsonb_build_object('ok', true, 'reason', 'ok');
end;
$$;
grant execute on function verify_staff_claim(uuid, text) to anon, authenticated;

-- handle_new_user: re-verificación de servidor (candado real). Mismo comportamiento
-- que 0009 pero con throttling y comparación de código hasheado en la rama staff.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
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
    perform register_claim_attempt(v_pid, 'player');
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

  -- (B) Staff de la lista: metadata trae staff_id → verifica código hasheado.
  if v_sid is not null then
    select * into st from staff_members where id = v_sid and is_active = true;
    if not found then raise exception 'Acceso de staff no encontrado.'; end if;
    if exists (select 1 from profiles where staff_member_id = v_sid) then
      raise exception 'Este acceso ya fue usado.';
    end if;
    if coalesce(btrim(st.access_code), '') = '' then
      raise exception 'Este acceso no tiene código configurado.';
    end if;
    perform register_claim_attempt(v_sid, 'staff');
    v_code := new.raw_user_meta_data->>'access_code';
    if st.access_code <> crypt(btrim(coalesce(v_code, '')), st.access_code) then
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

-- ===========================================================================
-- [MEDIUM] Cierra la evasión del tope de 5 cambios. El capitán ya NO escribe
-- lineups/lineup_entries directo por PostgREST; save_lineup (única puerta) pasa a
-- SECURITY DEFINER y registra los change_logs (el trigger enforce_change_limit
-- hace cumplir el tope). Se conservan las políticas de SELECT del capitán.
-- ===========================================================================
drop policy if exists "captain insert own lineups"  on lineups;
drop policy if exists "captain update own lineups"  on lineups;
drop policy if exists "captain insert own entries"  on lineup_entries;
drop policy if exists "captain update own entries"  on lineup_entries;

create or replace function save_lineup(
  p_team_matchup_id uuid,
  p_team_id uuid,          -- solo lo usa el organizador; para el capitán se ignora
  p_submit boolean,
  p_entries jsonb          -- [{category_code, match_id, player_1_id, player_2_id}]
) returns uuid
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_team    uuid;
  v_round   uuid;
  v_lineup  lineups%rowtype;
  v_prev    lineup_status;
  v_now     timestamptz := now();
  e         jsonb;
  v_cat     text;
  v_match   uuid;
  v_p1      uuid;
  v_p2      uuid;
  v_pp1     uuid;
  v_pp2     uuid;
begin
  -- Equipo de forma segura (nunca se confía del cliente para el capitán).
  if is_organizer() then
    v_team := p_team_id;
  else
    v_team := captain_team_id();
    if v_team is null then
      raise exception 'Solo el capitán de un equipo puede guardar alineaciones.';
    end if;
  end if;
  if v_team is null then
    raise exception 'No se pudo determinar el equipo de la alineación.';
  end if;

  -- Serializa por equipo: evita que dos guardados concurrentes rebasen el tope de 5.
  perform pg_advisory_xact_lock(hashtextextended(v_team::text, 0));

  select min(m.round_id) into v_round
  from matches m where m.team_matchup_id = p_team_matchup_id;

  select * into v_lineup
  from lineups
  where team_matchup_id = p_team_matchup_id and team_id = v_team;

  if not found then
    insert into lineups (team_matchup_id, team_id, submitted_by, status, submitted_at)
    values (
      p_team_matchup_id, v_team, auth.uid(),
      case when p_submit then 'submitted'::lineup_status else 'draft'::lineup_status end,
      case when p_submit then v_now else null end
    )
    returning * into v_lineup;
  else
    v_prev := v_lineup.status;

    -- Modificación tras el primer envío: un log por categoría con pareja distinta.
    -- El trigger enforce_change_limit hace cumplir el tope de 5 (lanza si se supera).
    if v_prev <> 'draft' then
      for e in select * from jsonb_array_elements(p_entries) loop
        v_cat   := e->>'category_code';
        v_match := nullif(e->>'match_id', '')::uuid;
        v_p1    := nullif(e->>'player_1_id', '')::uuid;
        v_p2    := nullif(e->>'player_2_id', '')::uuid;

        select player_1_id, player_2_id into v_pp1, v_pp2
        from lineup_entries
        where lineup_id = v_lineup.id and category_code = v_cat;

        if pair_key(v_p1, v_p2) is distinct from pair_key(v_pp1, v_pp2) then
          insert into lineup_change_logs
            (lineup_id, team_id, round_id, match_id, changed_by, before_data, after_data)
          values (
            v_lineup.id, v_team, v_round, v_match, auth.uid(),
            jsonb_build_object('player_1_id', v_pp1, 'player_2_id', v_pp2),
            jsonb_build_object('player_1_id', v_p1,  'player_2_id', v_p2)
          );
        end if;
      end loop;
    end if;

    update lineups set
      status = case
                 when p_submit and v_prev = 'draft' then 'submitted'::lineup_status
                 when p_submit then 'modified'::lineup_status
                 else v_prev
               end,
      submitted_by = auth.uid(),
      submitted_at = coalesce(v_lineup.submitted_at, case when p_submit then v_now else null end)
    where id = v_lineup.id
    returning * into v_lineup;
  end if;

  -- Upsert de entradas (una por categoría con partido).
  for e in select * from jsonb_array_elements(p_entries) loop
    v_cat   := e->>'category_code';
    v_match := nullif(e->>'match_id', '')::uuid;
    v_p1    := nullif(e->>'player_1_id', '')::uuid;
    v_p2    := nullif(e->>'player_2_id', '')::uuid;

    if v_match is not null then
      insert into lineup_entries (lineup_id, match_id, category_code, player_1_id, player_2_id)
      values (v_lineup.id, v_match, v_cat, v_p1, v_p2)
      on conflict (lineup_id, category_code) do update
        set match_id = excluded.match_id,
            player_1_id = excluded.player_1_id,
            player_2_id = excluded.player_2_id;
    end if;
  end loop;

  return v_lineup.id;
end;
$$;
grant execute on function save_lineup(uuid, uuid, boolean, jsonb) to authenticated;

-- ===========================================================================
-- [MEDIUM] Storage: restringe el bucket 'media' a imágenes + PDF y ≤10 MB
-- (bloquea SVG/HTML con script = XSS almacenado, y el abuso de almacenamiento),
-- y liga la subida de foto de jugador a SU carpeta players/<uid>/.
-- ===========================================================================
update storage.buckets
   set allowed_mime_types = array[
         'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'
       ],
       file_size_limit = 10485760  -- 10 MB
 where id = 'media';

drop policy if exists "players upload own photo" on storage.objects;
create policy "players upload own photo" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'players'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ===========================================================================
-- [MEDIUM] make_pick hace cumplir el reloj del draft en el SERVIDOR. Antes solo
-- auto_pick miraba el deadline; una capitana con turno vencido podía seguir
-- eligiendo mientras el draft estuviera activo. Ahora, si el turno venció, se
-- dispara auto_pick y se termina (no se lanza excepción para no revertir el
-- auto_pick dentro de la misma transacción).
-- ===========================================================================
create or replace function make_pick(p_draft_id uuid, p_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d        drafts%rowtype;
  slot     draft_picks%rowtype;
  v_cap    uuid;
  v_player players%rowtype;
begin
  select * into d from drafts where id = p_draft_id for update;
  if not found then raise exception 'Draft no encontrado.'; end if;
  if d.status <> 'active' then raise exception 'El draft no está activo.'; end if;

  -- Reloj impuesto por el servidor: turno vencido → selección automática y salida.
  if not is_organizer() and d.pick_deadline is not null and now() > d.pick_deadline then
    perform auto_pick(p_draft_id);
    return;
  end if;

  select * into slot from draft_picks
  where draft_id = p_draft_id and player_id is null order by pick_number limit 1;
  if not found then raise exception 'No hay picks pendientes.'; end if;

  v_cap := captain_team_id();
  if not is_organizer() and (v_cap is null or v_cap <> slot.team_id) then
    raise exception 'No es tu turno.';
  end if;

  select * into v_player from players where id = p_player_id;
  if not found then raise exception 'Jugador no encontrado.'; end if;
  if v_player.team_id is not null then raise exception 'Ese jugador ya tiene equipo.'; end if;
  if not v_player.is_active or v_player.season_id <> d.season_id
     or v_player.category_code <> slot.category_code then
    raise exception 'Jugador no elegible para este pick.';
  end if;

  update draft_picks
  set player_id = p_player_id, picked_at = now(), was_auto = false, picked_by = current_player_id()
  where id = slot.id;
  update players set team_id = slot.team_id where id = p_player_id;

  perform advance_draft(p_draft_id);
end $$;
