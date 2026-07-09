-- 0028_draft_live_category_draw.sql
-- Dos cambios al draft:
--
--  (1) SORTEO DE ORDEN POR CATEGORÍA, EN VIVO. Antes había un orden global fijo y
--      el board se generaba de golpe. Ahora el draft avanza categoría por categoría:
--      antes de cada una entra en fase "sorteo" (drafts.is_drawing=true), el
--      servidor sortea el orden de esa categoría (draft_category_orders) y todos lo
--      ven; el organizador pulsa "empezar categoría" (begin_category) y arrancan los
--      picks. El orden es AUTORITATIVO del servidor (todos animan hacia el mismo).
--
--  (2) "NO PICK" DE LA CAPITANA. La capitana ya está en su equipo (fuera del pool).
--      En su categoría, su equipo hace un pick menos: su ÚLTIMO slot se marca
--      is_skip=true ("no pick") y el motor lo salta. Se generan slots de más
--      (uno por equipo con capitana) y se recorta el excedente, de modo que los
--      slots reales (no-skip) = tamaño del pool → TODOS los del pool se draftean y
--      los rosters quedan balanceados.
--
-- No se agrega valor al enum draft_status (para no partir en dos transacciones):
-- la fase de sorteo se representa con drafts.is_drawing sobre status='active'.

-- ---------------------------------------------------------------------------
-- Esquema
-- ---------------------------------------------------------------------------
alter table drafts add column if not exists current_category_code text references match_categories(code);
alter table drafts add column if not exists is_drawing boolean not null default false;
alter table draft_picks add column if not exists is_skip boolean not null default false;

-- Orden sorteado por categoría (visible para todos; base de la animación).
create table if not exists draft_category_orders (
  id            uuid primary key default gen_random_uuid(),
  draft_id      uuid not null references drafts(id) on delete cascade,
  category_code text not null references match_categories(code),
  team_id       uuid not null references teams(id) on delete cascade,
  position      int  not null check (position > 0),
  created_at    timestamptz not null default now(),
  unique (draft_id, category_code, team_id),
  unique (draft_id, category_code, position)
);
alter table draft_category_orders enable row level security;
drop policy if exists "public read draft_category_orders" on draft_category_orders;
create policy "public read draft_category_orders" on draft_category_orders for select using (true);
drop policy if exists "organizer all draft_category_orders" on draft_category_orders;
create policy "organizer all draft_category_orders" on draft_category_orders for all using (is_organizer()) with check (is_organizer());
grant select on draft_category_orders to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers internos (los llaman las funciones DEFINER; sin EXECUTE para el cliente)
-- ---------------------------------------------------------------------------

-- Sortea (aleatorio) el orden de una categoría a partir de los equipos participantes.
create or replace function draw_category_order(p_draft_id uuid, p_category text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from draft_category_orders where draft_id = p_draft_id and category_code = p_category;
  insert into draft_category_orders (draft_id, category_code, team_id, position)
  select p_draft_id, p_category, dt.team_id, row_number() over (order by random())
  from draft_teams dt
  where dt.draft_id = p_draft_id;
end $$;
revoke all on function draw_category_order(uuid, text) from public;

-- Siguiente categoría a draftear: la de menor sort_order (no mixta, activa) con
-- jugadores en el pool y que aún NO tiene picks creados en este draft.
create or replace function next_draft_category(p_draft_id uuid, p_season uuid)
returns text language sql stable security definer set search_path = public as $$
  select mc.code
  from match_categories mc
  where mc.type <> 'mixta' and mc.is_active
    and exists (
      select 1 from players p
      where p.season_id = p_season and p.team_id is null and p.is_active
        and not p.is_waitlisted and p.category_code = mc.code
    )
    and not exists (
      select 1 from draft_picks dp where dp.draft_id = p_draft_id and dp.category_code = mc.code
    )
  order by mc.sort_order
  limit 1;
$$;
revoke all on function next_draft_category(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- Iniciar: valida, y entra en la fase de SORTEO de la primera categoría (NO crea
-- picks todavía). El organizador luego pulsa begin_category.
-- ---------------------------------------------------------------------------
create or replace function start_draft(p_draft_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d drafts%rowtype; v_n int; v_cat text;
begin
  if not is_organizer() then raise exception 'Solo el organizador puede iniciar el draft.'; end if;
  select * into d from drafts where id = p_draft_id for update;
  if not found then raise exception 'Draft no encontrado.'; end if;
  if d.status <> 'setup' then raise exception 'El draft ya fue iniciado.'; end if;

  select count(*) into v_n from draft_teams where draft_id = p_draft_id;
  if v_n < 2 then raise exception 'Asigna al menos 2 equipos participantes antes de iniciar.'; end if;

  delete from draft_picks where draft_id = p_draft_id;            -- idempotencia defensiva
  delete from draft_category_orders where draft_id = p_draft_id;

  v_cat := next_draft_category(p_draft_id, d.season_id);
  if v_cat is null then raise exception 'No hay jugadores en el pool para draftear.'; end if;

  perform draw_category_order(p_draft_id, v_cat);
  update drafts
  set status = 'active', is_drawing = true, current_category_code = v_cat,
      pick_deadline = null, paused_remaining_ms = null
  where id = p_draft_id;
end $$;

-- ---------------------------------------------------------------------------
-- Empezar la categoría sorteada: genera sus slots (snake con el orden sorteado +
-- "no pick" de capitanas) y arranca el reloj. Solo organizador.
-- ---------------------------------------------------------------------------
create or replace function begin_category(p_draft_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d          drafts%rowtype;
  v_cat      text;
  v_team_ids uuid[];
  v_n        int;
  v_pool     int;
  v_capteams uuid[];
  v_extra    int;
  v_total    int;
  v_rounds   int;
  v_made     int;
  v_base     int;
  v_pick     int;
  v_surplus  int;
  r int; i int; v_idx int;
begin
  if not is_organizer() then raise exception 'Solo el organizador puede empezar la categoría.'; end if;
  select * into d from drafts where id = p_draft_id for update;
  if not found then raise exception 'Draft no encontrado.'; end if;
  if d.status <> 'active' or not d.is_drawing then
    raise exception 'No hay un sorteo pendiente por iniciar.';
  end if;
  v_cat := d.current_category_code;
  if v_cat is null then raise exception 'Sin categoría actual.'; end if;

  select array_agg(team_id order by position) into v_team_ids
  from draft_category_orders where draft_id = p_draft_id and category_code = v_cat;
  v_n := coalesce(array_length(v_team_ids, 1), 0);
  if v_n < 2 then raise exception 'Falta el sorteo de orden de la categoría.'; end if;

  select count(*) into v_pool from players
  where season_id = d.season_id and team_id is null and is_active
    and not is_waitlisted and category_code = v_cat;

  -- Equipos cuya capitana juega esta categoría (ya la tienen en su roster).
  select array_agg(distinct me.team_id) into v_capteams
  from players me
  where me.season_id = d.season_id and me.is_captain and me.team_id is not null
    and me.category_code = v_cat and me.team_id = any(v_team_ids);
  v_extra := coalesce(array_length(v_capteams, 1), 0);

  v_total := v_pool + v_extra;   -- 1 slot extra por capitana (será su "no pick")
  select coalesce(max(pick_number), 0) into v_base from draft_picks where draft_id = p_draft_id;

  -- Snake con el orden sorteado.
  v_rounds := ceil(v_total::numeric / v_n);
  v_made := 0; v_pick := v_base;
  for r in 1..v_rounds loop
    for i in 1..v_n loop
      exit when v_made >= v_total;
      if r % 2 = 1 then v_idx := i; else v_idx := v_n - i + 1; end if;
      v_pick := v_pick + 1;
      insert into draft_picks (draft_id, pick_number, category_code, round, team_id)
      values (p_draft_id, v_pick, v_cat, r, v_team_ids[v_idx]);
      v_made := v_made + 1;
    end loop;
  end loop;

  -- Marca "no pick" el ÚLTIMO slot de cada equipo con capitana en la categoría.
  if v_extra > 0 then
    update draft_picks set is_skip = true where id in (
      select distinct on (team_id) id
      from draft_picks
      where draft_id = p_draft_id and category_code = v_cat and team_id = any(v_capteams)
      order by team_id, pick_number desc
    );
  end if;

  -- Nunca dejar más slots REALES (no-skip) que jugadores en el pool: recorta el
  -- excedente por la cola (casos de pool muy chico donde algún equipo con capitana
  -- no alcanzó turno). Garantiza no-skip = v_pool → todos se draftean, sin cuelgues.
  v_surplus := (select count(*) from draft_picks
                where draft_id = p_draft_id and category_code = v_cat and not is_skip) - v_pool;
  if v_surplus > 0 then
    delete from draft_picks where id in (
      select id from draft_picks
      where draft_id = p_draft_id and category_code = v_cat and not is_skip and player_id is null
      order by pick_number desc
      limit v_surplus
    );
  end if;

  update drafts
  set is_drawing = false, pick_deadline = now() + make_interval(secs => pick_seconds)
  where id = p_draft_id;
end $$;
grant execute on function begin_category(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Avanzar tras cada pick: si quedan picks reales en la categoría actual, refresca
-- el reloj; si no, pasa a SORTEAR la siguiente categoría (o termina el draft).
-- ---------------------------------------------------------------------------
create or replace function advance_draft(p_draft_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d drafts%rowtype; v_next text;
begin
  select * into d from drafts where id = p_draft_id for update;
  if not found then return; end if;

  if exists (
    select 1 from draft_picks
    where draft_id = p_draft_id and category_code = d.current_category_code
      and player_id is null and not is_skip
  ) then
    update drafts set pick_deadline = now() + make_interval(secs => pick_seconds)
    where id = p_draft_id;
    return;
  end if;

  v_next := next_draft_category(p_draft_id, d.season_id);
  if v_next is null then
    update drafts set status = 'finished', is_drawing = false,
                      current_category_code = null, pick_deadline = null
    where id = p_draft_id;
  else
    perform draw_category_order(p_draft_id, v_next);
    update drafts set is_drawing = true, current_category_code = v_next, pick_deadline = null
    where id = p_draft_id;
  end if;
end $$;
revoke all on function advance_draft(uuid) from public;

-- ---------------------------------------------------------------------------
-- Elegir (capitana de turno u organizador). Turno = equipo del slot abierto actual
-- (según el orden sorteado). Ignora slots is_skip.
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
  if d.is_drawing then raise exception 'El sorteo de la categoría aún no ha empezado.'; end if;

  if not is_organizer() and d.pick_deadline is not null and now() > d.pick_deadline then
    perform auto_pick(p_draft_id);
    return;
  end if;

  select * into slot from draft_picks
  where draft_id = p_draft_id and player_id is null and not is_skip
  order by pick_number limit 1;
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
  set player_id = p_player_id, picked_at = now(), was_auto = false, picked_by = auth.uid()
  where id = slot.id;
  update players set team_id = slot.team_id where id = p_player_id;

  perform advance_draft(p_draft_id);
end $$;

-- ---------------------------------------------------------------------------
-- Auto-pick al vencer el reloj. Idempotente. Ignora slots is_skip y la fase sorteo.
-- ---------------------------------------------------------------------------
create or replace function auto_pick(p_draft_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d drafts%rowtype; slot draft_picks%rowtype; v_pid uuid;
begin
  select * into d from drafts where id = p_draft_id for update;
  if not found then return; end if;
  if d.status <> 'active' or d.is_drawing or d.pick_deadline is null or d.pick_deadline > now() then
    return;
  end if;

  select * into slot from draft_picks
  where draft_id = p_draft_id and player_id is null and not is_skip
  order by pick_number limit 1;
  if not found then
    perform advance_draft(p_draft_id);
    return;
  end if;

  select id into v_pid from players
  where season_id = d.season_id and team_id is null and is_active
    and not is_waitlisted and category_code = slot.category_code
  order by random() limit 1;

  if v_pid is null then
    delete from draft_picks where id = slot.id;   -- slot huérfano: se omite
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
-- Reiniciar (pruebas): devuelve jugadores al pool, borra board + órdenes sorteadas
-- y vuelve a 'setup'. Reemplaza a 0021 sumando la limpieza del nuevo estado.
-- ---------------------------------------------------------------------------
create or replace function reset_draft(p_draft_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d drafts%rowtype;
begin
  if not is_organizer() then raise exception 'Solo el organizador puede reiniciar el draft.'; end if;
  select * into d from drafts where id = p_draft_id for update;
  if not found then raise exception 'Draft no encontrado.'; end if;

  update players pl set team_id = null
  from draft_picks dp
  where dp.draft_id = p_draft_id and dp.player_id = pl.id;

  delete from draft_picks where draft_id = p_draft_id;
  delete from draft_category_orders where draft_id = p_draft_id;

  update drafts
  set status = 'setup', is_drawing = false, current_category_code = null,
      pick_deadline = null, paused_remaining_ms = null
  where id = p_draft_id;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime: empuja las órdenes sorteadas a todos (para la animación en vivo).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'draft_category_orders'
  ) then
    alter publication supabase_realtime add table draft_category_orders;
  end if;
end $$;
