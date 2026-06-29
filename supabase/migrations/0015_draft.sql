-- 0015_draft.sql
-- Draft en vivo cronometrado (estilo NFL). Las capitanas eligen jugadores del
-- pool por categoría, en orden snake, con timer y auto-pick. Estado compartido
-- en tiempo real (Realtime). Toda validación crítica vive en RPCs server-side
-- (CLAUDE.md §3.5), no solo en la UI.

-- ---------------------------------------------------------------------------
-- Pool: un jugador puede existir SIN equipo hasta ser drafteado.
-- Las vistas (players_public, team_standings, player_rankings) y el índice
-- one_captain_per_team siguen válidos: los rosters filtran por equipo, así que
-- los del pool (team_id null) no aparecen en ningún roster hasta ser elegidos.
-- ---------------------------------------------------------------------------
alter table players alter column team_id drop not null;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type draft_status as enum ('setup', 'active', 'paused', 'finished');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
-- Un draft por temporada. Estado "en vivo" + reloj compartido.
create table drafts (
  id                   uuid primary key default gen_random_uuid(),
  season_id            uuid not null unique references seasons(id) on delete cascade,
  status               draft_status not null default 'setup',
  pick_seconds         int not null default 90 check (pick_seconds between 10 and 600),
  pick_deadline        timestamptz,          -- vence el pick actual (null si pausado/sin iniciar)
  paused_remaining_ms  int,                  -- ms restantes al pausar (para reanudar)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Orden de elección (snake). El organizador fija pick_number 1..N.
create table draft_teams (
  id           uuid primary key default gen_random_uuid(),
  draft_id     uuid not null references drafts(id) on delete cascade,
  team_id      uuid not null references teams(id) on delete cascade,
  pick_number  int not null check (pick_number > 0),
  created_at   timestamptz not null default now(),
  unique (draft_id, team_id),
  unique (draft_id, pick_number)
);

-- El BOARD: slots precomputados al iniciar. player_id vacío hasta que se elige.
-- El "pick actual" = menor pick_number con player_id null.
create table draft_picks (
  id            uuid primary key default gen_random_uuid(),
  draft_id      uuid not null references drafts(id) on delete cascade,
  pick_number   int not null,                 -- orden global del pick (1-based)
  category_code text not null references match_categories(code),
  round         int not null,
  team_id       uuid not null references teams(id) on delete cascade,
  player_id     uuid references players(id) on delete set null,
  picked_at     timestamptz,
  was_auto      boolean not null default false,
  picked_by     uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (draft_id, pick_number)
);

create index draft_picks_open_idx on draft_picks (draft_id, pick_number) where player_id is null;
create index draft_picks_draft_idx on draft_picks (draft_id, pick_number);

create trigger trg_drafts_updated_at before update on drafts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Avanzar el reloj: fija el siguiente deadline, o cierra el draft si no quedan
-- picks. Interno (lo llaman make_pick/auto_pick dentro de su transacción).
-- ---------------------------------------------------------------------------
create or replace function advance_draft(p_draft_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from draft_picks where draft_id = p_draft_id and player_id is null) then
    update drafts set pick_deadline = now() + make_interval(secs => pick_seconds)
    where id = p_draft_id;
  else
    update drafts set status = 'finished', pick_deadline = null where id = p_draft_id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fijar el orden de elección (antes de iniciar). p_order = [{team_id, pick_number}]
-- ---------------------------------------------------------------------------
create or replace function set_draft_order(p_draft_id uuid, p_order jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare d drafts%rowtype; item jsonb;
begin
  if not is_organizer() then raise exception 'Solo el organizador.'; end if;
  select * into d from drafts where id = p_draft_id for update;
  if not found then raise exception 'Draft no encontrado.'; end if;
  if d.status <> 'setup' then raise exception 'Solo se puede ordenar antes de iniciar.'; end if;
  delete from draft_teams where draft_id = p_draft_id;
  for item in select * from jsonb_array_elements(p_order)
  loop
    insert into draft_teams (draft_id, team_id, pick_number)
    values (p_draft_id, (item->>'team_id')::uuid, (item->>'pick_number')::int);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Iniciar: genera los slots (snake por categoría, en sort_order, según el conteo
-- del pool por categoría — snapshot AHORA, cerrar registro antes) y arranca el reloj.
-- ---------------------------------------------------------------------------
create or replace function start_draft(p_draft_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d           drafts%rowtype;
  v_team_ids  uuid[];
  v_n         int;
  v_cat       record;
  v_count     int;
  v_rounds    int;
  v_made      int;
  v_pick      int := 0;
  r           int;
  i           int;
  v_idx       int;
begin
  if not is_organizer() then raise exception 'Solo el organizador puede iniciar el draft.'; end if;

  select * into d from drafts where id = p_draft_id for update;
  if not found then raise exception 'Draft no encontrado.'; end if;
  if d.status <> 'setup' then raise exception 'El draft ya fue iniciado.'; end if;

  select array_agg(team_id order by pick_number) into v_team_ids
  from draft_teams where draft_id = p_draft_id;
  v_n := coalesce(array_length(v_team_ids, 1), 0);
  if v_n < 2 then raise exception 'Asigna el orden de al menos 2 equipos antes de iniciar.'; end if;

  delete from draft_picks where draft_id = p_draft_id;  -- idempotencia defensiva

  for v_cat in
    select code from match_categories where type <> 'mixta' and is_active order by sort_order
  loop
    select count(*) into v_count
    from players
    where season_id = d.season_id and team_id is null and is_active and category_code = v_cat.code;
    if v_count = 0 then continue; end if;

    v_rounds := ceil(v_count::numeric / v_n);
    v_made := 0;
    for r in 1..v_rounds loop
      for i in 1..v_n loop
        exit when v_made >= v_count;
        if r % 2 = 1 then v_idx := i; else v_idx := v_n - i + 1; end if;   -- snake
        v_pick := v_pick + 1;
        insert into draft_picks (draft_id, pick_number, category_code, round, team_id)
        values (p_draft_id, v_pick, v_cat.code, r, v_team_ids[v_idx]);
        v_made := v_made + 1;
      end loop;
    end loop;
  end loop;

  if v_pick = 0 then raise exception 'No hay jugadores en el pool para draftear.'; end if;

  update drafts
  set status = 'active',
      pick_deadline = now() + make_interval(secs => pick_seconds),
      paused_remaining_ms = null
  where id = p_draft_id;
end $$;

-- ---------------------------------------------------------------------------
-- Elegir (capitana de turno u organizador). Lock sobre drafts = serializa.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Auto-pick aleatorio al vencer el reloj. Idempotente: solo actúa si está
-- activo y el deadline venció → seguro ante llamadas concurrentes (anfitrión +
-- fallback de capitanas).
-- ---------------------------------------------------------------------------
create or replace function auto_pick(p_draft_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d drafts%rowtype; slot draft_picks%rowtype; v_pid uuid;
begin
  select * into d from drafts where id = p_draft_id for update;
  if not found then return; end if;
  if d.status <> 'active' or d.pick_deadline is null or d.pick_deadline > now() then
    return;
  end if;

  select * into slot from draft_picks
  where draft_id = p_draft_id and player_id is null order by pick_number limit 1;
  if not found then
    update drafts set status = 'finished', pick_deadline = null where id = p_draft_id;
    return;
  end if;

  select id into v_pid from players
  where season_id = d.season_id and team_id is null and is_active and category_code = slot.category_code
  order by random() limit 1;

  if v_pid is null then
    delete from draft_picks where id = slot.id;   -- slot huérfano (no debería pasar); se omite
    perform advance_draft(p_draft_id);
    return;
  end if;

  update draft_picks
  set player_id = v_pid, picked_at = now(), was_auto = true, picked_by = null
  where id = slot.id;
  update players set team_id = slot.team_id where id = v_pid;

  perform advance_draft(p_draft_id);
end $$;

-- ---------------------------------------------------------------------------
-- Pausar / reanudar (organizador). Conserva el tiempo restante.
-- ---------------------------------------------------------------------------
create or replace function pause_draft(p_draft_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d drafts%rowtype;
begin
  if not is_organizer() then raise exception 'Solo el organizador puede pausar.'; end if;
  select * into d from drafts where id = p_draft_id for update;
  if not found then raise exception 'Draft no encontrado.'; end if;
  if d.status <> 'active' then raise exception 'El draft no está activo.'; end if;
  update drafts
  set status = 'paused',
      paused_remaining_ms = greatest(0, (extract(epoch from (d.pick_deadline - now())) * 1000)::int),
      pick_deadline = null
  where id = p_draft_id;
end $$;

create or replace function resume_draft(p_draft_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d drafts%rowtype;
begin
  if not is_organizer() then raise exception 'Solo el organizador puede reanudar.'; end if;
  select * into d from drafts where id = p_draft_id for update;
  if not found then raise exception 'Draft no encontrado.'; end if;
  if d.status <> 'paused' then raise exception 'El draft no está pausado.'; end if;
  update drafts
  set status = 'active',
      pick_deadline = now() + make_interval(secs => greatest(1, coalesce(d.paused_remaining_ms, 0)) / 1000.0),
      paused_remaining_ms = null
  where id = p_draft_id;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: lectura PÚBLICA del board (nombres de equipos/jugadores ya son públicos);
-- gestión del organizador. Las elecciones van por los RPC DEFINER de arriba.
-- ---------------------------------------------------------------------------
alter table drafts      enable row level security;
alter table draft_teams enable row level security;
alter table draft_picks enable row level security;

create policy "public read drafts"      on drafts      for select using (true);
create policy "public read draft_teams" on draft_teams for select using (true);
create policy "public read draft_picks" on draft_picks for select using (true);

create policy "organizer all drafts"      on drafts      for all using (is_organizer()) with check (is_organizer());
create policy "organizer all draft_teams" on draft_teams for all using (is_organizer()) with check (is_organizer());
create policy "organizer all draft_picks" on draft_picks for all using (is_organizer()) with check (is_organizer());

grant select on drafts, draft_teams, draft_picks to anon, authenticated;
grant execute on function
  set_draft_order(uuid, jsonb), start_draft(uuid), make_pick(uuid, uuid),
  auto_pick(uuid), pause_draft(uuid), resume_draft(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: empuja cambios de estado y picks a todos los clientes al instante.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table drafts;
alter publication supabase_realtime add table draft_picks;
