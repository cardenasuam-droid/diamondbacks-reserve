-- 0023_waitlist.sql
-- Lista de espera (waitlist): cuando hay más jugadores en el pool que cupos para
-- el draft, el organizador aparta a algunos a una "banca". Un jugador en lista de
-- espera sigue activo y sin equipo (team_id null), pero NO cuenta como pool: no
-- aparece en la pantalla de pool ni en el selector del draft, y los RPC del draft
-- lo excluyen del conteo/auto-pick (defensa en el servidor, CLAUDE.md §3.5).
-- Movimiento bidireccional pool ⇄ lista de espera, solo organizador.

-- ---------------------------------------------------------------------------
-- Columna + marca de tiempo (para ordenar la lista por antigüedad, FIFO)
-- ---------------------------------------------------------------------------
alter table players
  add column if not exists is_waitlisted boolean not null default false,
  add column if not exists waitlisted_at timestamptz;

-- Sella waitlisted_at en el servidor al cambiar is_waitlisted.
create or replace function set_player_waitlist_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_waitlisted is distinct from (case when tg_op = 'UPDATE' then old.is_waitlisted else null end) then
    new.waitlisted_at := case when new.is_waitlisted then now() else null end;
  end if;
  return new;
end $$;

drop trigger if exists trg_players_waitlist_audit on players;
create trigger trg_players_waitlist_audit
  before insert or update on players
  for each row execute function set_player_waitlist_audit();

-- ---------------------------------------------------------------------------
-- Vista pública: expone is_waitlisted (no es dato sensible) para que el pool y el
-- draft filtren en el cliente. `create or replace` conserva grants y solo añade la
-- columna al final. El resto idéntico a 0012.
-- ---------------------------------------------------------------------------
create or replace view players_public as
select id, season_id, team_id, full_name, gender, category_code,
       is_captain, is_active, photo_url, is_waitlisted
from players
where is_active = true;

-- ---------------------------------------------------------------------------
-- RPCs del draft: excluir a los de lista de espera del pool elegible. Se reemplaza
-- el cuerpo completo (de 0015/0018) añadiendo `and not is_waitlisted`.
-- ---------------------------------------------------------------------------

-- start_draft: el conteo por categoría que genera los slots ignora a los waitlisted.
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
    where season_id = d.season_id and team_id is null and is_active
      and not is_waitlisted and category_code = v_cat.code;
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

-- auto_pick: el sorteo al vencer el reloj tampoco toma a los waitlisted.
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
  where season_id = d.season_id and team_id is null and is_active
    and not is_waitlisted and category_code = slot.category_code
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

-- make_pick: rechaza elegir a un jugador en lista de espera (defensa en profundidad).
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
  if v_player.is_waitlisted then
    raise exception 'Ese jugador está en lista de espera; regrésalo al pool antes de elegirlo.';
  end if;
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
