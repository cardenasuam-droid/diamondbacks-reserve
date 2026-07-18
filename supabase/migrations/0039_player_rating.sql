-- 0039_player_rating.sql
-- Sistema de RATING (ELO) por jugador.
--
-- POR QUÉ EXISTE: la tabla de posiciones y el ranking individual miden RESULTADO
-- deportivo (puntos 3/1/0 por partido ganado). El rating mide NIVEL: cuánto vale
-- un jugador contra quién juega. Sirve para la ficha pública y, entre temporadas,
-- para detectar quién está inscrito en una categoría que ya no le corresponde.
--
-- EXCEPCIÓN CONSCIENTE A CLAUDE.md §3.4 ("puntos, tabla y ranking se DERIVAN, no
-- se almacenan"): el ELO es recursivo — el rating de hoy depende del de ayer — así
-- que NO se puede expresar como vista SQL. Hay que materializarlo. Se respeta el
-- espíritu de la regla así: lo único que se CAPTURA a mano es la semilla
-- (rating_seed) y los ajustes manuales (player_rating_adjustments). El rating
-- vigente y su historia son función determinista de
--     semilla + ajustes + match_results + lineup_entries
-- y se reproducen enteros desde cero con un recálculo. NADIE edita el rating final
-- a mano; no hay UPDATE incremental que pueda desincronizarse.
--
-- POR QUÉ RECÁLCULO COMPLETO Y NO INCREMENTAL: los resultados se guardan con
-- upsert sobre match_id (useSaveResult.ts), así que corregir un marcador
-- SOBRESCRIBE la fila y no queda rastro del valor anterior; y las alineaciones
-- siguen siendo editables después de cargado el resultado. Un motor incremental
-- no tendría de dónde leer el estado viejo para revertirlo. Con 330 partidos,
-- reproducir la temporada entera es instantáneo.
--
-- PRIVACIDAD: el organizador decidió rating PÚBLICO (aparece en la ficha y en el
-- ranking). Por eso rating/rating_matches se exponen en players_public y los
-- eventos son de lectura pública. Los AJUSTES MANUALES no: su campo `reason` es
-- texto libre del organizador y puede contener contexto que no debe publicarse
-- (mismo criterio que is_paid, 0022). Quedan bajo "organizer all"/"viewer read".

-- ---------------------------------------------------------------------------
-- 1. Parámetros del motor, como DATOS y no como código
--
-- Van en tabla (no hardcodeados en el front) para poder recalibrar sin migración
-- ni deploy: se cambia el valor, se corre el recálculo y toda la historia se
-- reproduce con la constante nueva. Decisión reversible por diseño.
--
-- Valores iniciales (calibrados sobre los 88 ratings dictados y una simulación
-- Monte Carlo del calendario real):
--   k_factor 60  — elegido por el organizador sobre los 40 que sugería la
--                  simulación. Con siembra plana (los 69 varones) K no altera el
--                  ORDEN del ranking, solo cuánto se separan; el coste real es que
--                  el ruido de temporada de un jugador bien sembrado sube de ±65 a
--                  ±98 sobre una dispersión intra-categoría real de ±166.
--   divisor 400  — 300 puntos (un escalón de categoría) = 85% de probabilidad.
--   mov_*        — el margen de juegos multiplica la K entre 0.75 y 1.35.
-- ---------------------------------------------------------------------------
create table if not exists rating_settings (
  id           int primary key default 1 check (id = 1),
  k_factor     numeric not null default 60,
  divisor      numeric not null default 400,
  mov_base     numeric not null default 0.75,
  mov_step     numeric not null default 0.05,
  mov_min      numeric not null default 0.75,
  mov_max      numeric not null default 1.35,
  -- Los walkovers NO mueven el rating: se registran 6-0 6-0 para la tabla, pero
  -- nadie jugó. Si entraran, darían el mayor movimiento posible (mov 1.35) por
  -- no presentarse el rival, y premiarían a alineaciones que pueden ser
  -- autogeneradas (useFinalizeRound) y no pisaron la cancha.
  count_walkovers boolean not null default false,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references profiles(id) on delete set null
);

insert into rating_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Semilla por categoría de ranking
--
-- Escalera decidida por el organizador, en pasos de 300. La escala es ABSOLUTA
-- entre géneros: FEM_5 y VAR_6 valen lo mismo (1500), igual que FEM_4/VAR_5
-- (1800) y FEM_3/VAR_4 (2100) — que son exactamente las parejas que se juntan en
-- las categorías mixtas (MIX_B, MIX_A, MIX_S). Eso es lo que hace legible un
-- ranking global que mezcla las 8 categorías.
-- ---------------------------------------------------------------------------
create table if not exists rating_category_seeds (
  category_code text primary key references match_categories(code),
  seed          numeric not null,
  updated_at    timestamptz not null default now()
);

insert into rating_category_seeds (category_code, seed) values
  ('FEM_7',  900),
  ('FEM_6', 1200),
  ('FEM_5', 1500),
  ('VAR_6', 1500),
  ('FEM_4', 1800),
  ('VAR_5', 1800),
  ('FEM_3', 2100),
  ('VAR_4', 2100)
-- do nothing y NO do update: si el organizador recalibra la escalera, re-ejecutar
-- esta migración no debe revertírsela. Mover una semilla de categoría cambia el
-- punto de partida de los 95 sembrados por categoría, y el siguiente recálculo
-- regeneraría la historia entera con otros números sin avisar a nadie. Mismo
-- criterio que rating_settings arriba.
on conflict (category_code) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Columnas en players
--
-- rating_seed         punto de partida (dictado por el organizador o por categoría)
-- rating_seed_source  'dictado' | 'categoria'  — de dónde salió, para la UI
-- rating              valor vigente = semilla + ajustes + deltas de partidos
-- rating_matches      partidos que ya movieron el rating (walkovers NO cuentan)
--
-- rating y rating_matches son CACHÉ de player_rating_events: se reconstruyen
-- enteros en cada recálculo. Nunca son fuente de verdad.
-- ---------------------------------------------------------------------------
alter table players
  add column if not exists rating_seed        numeric,
  add column if not exists rating_seed_source text,
  add column if not exists rating_seed_at     timestamptz,
  add column if not exists rating_seed_by     uuid references profiles(id) on delete set null,
  add column if not exists rating             numeric,
  add column if not exists rating_matches     int not null default 0;

alter table players drop constraint if exists players_rating_seed_source_check;
alter table players add constraint players_rating_seed_source_check
  check (rating_seed_source is null or rating_seed_source in ('dictado', 'categoria'));

-- ---------------------------------------------------------------------------
-- 4. Siembra automática del jugador nuevo + auditoría de la semilla
--
-- Regla del organizador: "cuando un jugador nuevo entra a la liga se le asigna
-- automáticamente por categoría". Se hace en el SERVIDOR para que valga igual si
-- el alta viene del formulario público, del import CSV o de SQL a mano.
--
-- Recategorización: si al jugador le cambian la categoría y su semilla venía de
-- la categoría (no dictada) y AÚN NO ha jugado, se resiembra. Si ya jugó, NO se
-- toca: mover la semilla bajo los pies de un rating con historia lo falsearía;
-- en ese caso el organizador ajusta a mano y queda auditado.
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER (el default) a propósito: la única tabla que lee es
-- rating_category_seeds, que tiene lectura pública, así que no hace falta elevar
-- privilegios. `pg_temp` va al final del search_path por higiene: es la primera
-- función de este repo que LEE una tabla desde un trigger, y sin fijarlo un
-- objeto temporal homónimo podría interponerse (mismo criterio que save_lineup).
create or replace function set_player_rating_seed()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_seed numeric;
begin
  if tg_op = 'INSERT' then
    if new.rating_seed is null then
      select seed into v_seed from rating_category_seeds where category_code = new.category_code;
      if v_seed is null then
        -- No abortamos el alta: dejar sin rating a un jugador es recuperable,
        -- impedir que se dé de alta en plena temporada no lo es. La categoría
        -- queda sin semilla y el aviso sale en los logs de Postgres; el panel de
        -- rating del organizador lista a los que quedaron sin semilla.
        raise warning 'Jugador % dado de alta en la categoría % sin semilla de rating (falta la fila en rating_category_seeds)',
          new.full_name, new.category_code;
      else
        new.rating_seed        := v_seed;
        new.rating_seed_source := 'categoria';
      end if;
    elsif new.rating_seed_source is null then
      new.rating_seed_source := 'dictado';
    end if;

    if new.rating is null then
      new.rating := new.rating_seed;
    end if;

    -- Sello de auditoría también en el alta (si no, todo jugador nuevo quedaría
    -- con rating_seed_at/by en null para siempre).
    if new.rating_seed is not null then
      new.rating_seed_at := now();
      new.rating_seed_by := auth.uid();
    end if;

    return new;
  end if;

  -- UPDATE: resiembra por cambio de categoría, solo si aún no tiene historia NI
  -- ajustes manuales. Un ajuste ya registrado significa que alguien decidió a
  -- mano dónde va este jugador; resembrarlo lo tiraría a la basura en silencio.
  if new.category_code is distinct from old.category_code
     and coalesce(new.rating_seed_source, '') = 'categoria'
     and coalesce(new.rating_matches, 0) = 0
     and new.rating_seed is not distinct from old.rating_seed
     and not exists (select 1 from player_rating_adjustments a where a.player_id = new.id) then
    select seed into v_seed from rating_category_seeds where category_code = new.category_code;
    if v_seed is not null then
      new.rating_seed := v_seed;
      new.rating      := v_seed;
    end if;
  end if;

  -- Sello de auditoría cuando la semilla cambia (venga de donde venga). Una
  -- semilla editada a mano pasa a ser 'dictado': es exactamente lo que es, y así
  -- deja de estar expuesta a la resiembra automática de arriba.
  if new.rating_seed is distinct from old.rating_seed then
    new.rating_seed_at := now();
    new.rating_seed_by := auth.uid();
    if coalesce(new.rating_seed_source, '') = 'categoria'
       and new.rating_seed_source is not distinct from old.rating_seed_source then
      new.rating_seed_source := 'dictado';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_players_rating_seed on players;
create trigger trg_players_rating_seed
  before insert or update on players
  for each row execute function set_player_rating_seed();

-- ---------------------------------------------------------------------------
-- 5. Ajustes manuales del organizador
--
-- El organizador NO sobrescribe el rating: registra un ajuste con motivo, fechado
-- en una jornada. El recálculo lo aplica en su punto de la línea de tiempo, así
-- que los ajustes SOBREVIVEN a cada recálculo y queda trazado quién, cuándo y
-- por qué. round_id null = se aplica antes de la primera jornada.
-- ---------------------------------------------------------------------------
create table if not exists player_rating_adjustments (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id) on delete cascade,
  season_id   uuid not null references seasons(id) on delete cascade,
  round_id    uuid references rounds(id) on delete set null,
  delta       numeric not null,
  reason      text not null,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (delta <> 0)
);

create index if not exists idx_rating_adjustments_player on player_rating_adjustments (player_id);
create index if not exists idx_rating_adjustments_season on player_rating_adjustments (season_id, round_id);

-- ---------------------------------------------------------------------------
-- 6. Historia: un evento por jugador y partido
--
-- Es la tabla que hace auditable el número: para cada partido guarda contra quién
-- se jugó, qué esperaba el modelo (expected) y cuánto se movió. De aquí sale la
-- gráfica de evolución de la ficha. Se BORRA Y REGENERA entera en cada recálculo,
-- por eso no lleva auditoría de autor: su autor es siempre el motor.
--
-- Se congelan partner_id y los ratings del momento (no se releen de
-- lineup_entries al consultar) porque las alineaciones son editables después del
-- resultado: sin congelar, la historia cambiaría sola bajo los pies.
-- ---------------------------------------------------------------------------
create table if not exists player_rating_events (
  id                   uuid primary key default gen_random_uuid(),
  season_id            uuid not null references seasons(id) on delete cascade,
  round_id             uuid not null references rounds(id) on delete cascade,
  match_id             uuid not null references matches(id) on delete cascade,
  player_id            uuid not null references players(id) on delete cascade,
  partner_id           uuid references players(id) on delete set null,
  team_id              uuid references teams(id),
  opponent_team_id     uuid references teams(id),
  category_code        text references match_categories(code),
  sequence             int not null,              -- orden cronológico global del recálculo
  rating_before        numeric not null,
  rating_after         numeric not null,
  delta                numeric not null,
  pair_rating          numeric not null,
  opponent_pair_rating numeric not null,
  expected             numeric not null,          -- E de la pareja propia, 0..1
  mov                  numeric not null,          -- multiplicador por margen de juegos
  won                  boolean not null,
  games_for            int,
  games_against        int,
  created_at           timestamptz not null default now(),
  unique (match_id, player_id)
);

create index if not exists idx_rating_events_player   on player_rating_events (player_id, sequence);
create index if not exists idx_rating_events_season   on player_rating_events (season_id, sequence);
create index if not exists idx_rating_events_round    on player_rating_events (round_id);

-- ---------------------------------------------------------------------------
-- 7. RLS
--
-- Se sigue el patrón de 0004/0020: lectura pública donde el dato es público,
-- "organizer all" para escribir, "viewer read" para el admin de solo lectura.
-- players ya tiene sus políticas; las columnas nuevas las heredan.
-- ---------------------------------------------------------------------------
alter table rating_settings          enable row level security;
alter table rating_category_seeds    enable row level security;
alter table player_rating_adjustments enable row level security;
alter table player_rating_events     enable row level security;

-- Público: el rating y su historia son públicos, igual que la tabla de posiciones.
drop policy if exists "public read rating_settings" on rating_settings;
create policy "public read rating_settings" on rating_settings for select using (true);

drop policy if exists "public read rating_category_seeds" on rating_category_seeds;
create policy "public read rating_category_seeds" on rating_category_seeds for select using (true);

-- Los eventos guardan player_id + partner_id + match_id, o sea LA PAREJA de cada
-- partido. Las alineaciones no son públicas hasta que la jornada se publica
-- (`lineups.locked_at`, migración 0036): si esta política fuera `using (true)`,
-- recalcular el rating con resultados capturados antes de publicar filtraría a
-- anon las parejas que 0036 protege. Se ata al mismo candado.
drop policy if exists "public read player_rating_events" on player_rating_events;
create policy "public read player_rating_events" on player_rating_events for select
  using (
    is_organizer() or is_viewer()
    or exists (
      select 1
        from lineup_entries le
        join lineups l on l.id = le.lineup_id
       where le.match_id = player_rating_events.match_id
         and l.locked_at is not null
    )
  );

-- Ajustes manuales: NO públicos (el motivo es texto libre del organizador).
drop policy if exists "organizer all rating_adjustments" on player_rating_adjustments;
create policy "organizer all rating_adjustments" on player_rating_adjustments
  for all using (is_organizer()) with check (is_organizer());

drop policy if exists "viewer read rating_adjustments" on player_rating_adjustments;
create policy "viewer read rating_adjustments" on player_rating_adjustments
  for select using (is_viewer());

-- Escritura de los parámetros, semillas y eventos: solo organizador.
drop policy if exists "organizer all rating_settings" on rating_settings;
create policy "organizer all rating_settings" on rating_settings
  for all using (is_organizer()) with check (is_organizer());

drop policy if exists "organizer all rating_category_seeds" on rating_category_seeds;
create policy "organizer all rating_category_seeds" on rating_category_seeds
  for all using (is_organizer()) with check (is_organizer());

drop policy if exists "organizer all rating_events" on player_rating_events;
create policy "organizer all rating_events" on player_rating_events
  for all using (is_organizer()) with check (is_organizer());

-- ---------------------------------------------------------------------------
-- Privilegios de tabla EXPLÍCITOS.
--
-- No basta con la RLS: los default privileges del rol `postgres` en `public`
-- conceden arwdDxtm a `anon` y `authenticated` sobre CUALQUIER tabla nueva, así
-- que sin este revoke `anon` conservaría privilegio de escritura sobre las cuatro
-- tablas y solo la RLS estaría deteniéndolo. Una puerta es mejor que ninguna;
-- dos son mejores que una. Mismo criterio que players_contact (0027).
-- ---------------------------------------------------------------------------
revoke all on rating_settings, rating_category_seeds, player_rating_events, player_rating_adjustments
  from anon, authenticated, public;

-- Lectura: pública para el rating y su historia; los ajustes manuales NO
-- (su campo `reason` es texto libre del organizador).
grant select on rating_settings, rating_category_seeds, player_rating_events to anon, authenticated;
grant select on player_rating_adjustments to authenticated;

-- Escritura: solo para usuarios con sesión. QUIÉN exactamente lo decide la RLS
-- ("organizer all"); el grant es la puerta exterior, la policy la interior.
-- anon queda sin ninguna escritura sobre estas cuatro tablas.
grant insert, update, delete on player_rating_events      to authenticated;
grant insert, update, delete on player_rating_adjustments to authenticated;
grant insert, update         on rating_category_seeds     to authenticated;
grant update                 on rating_settings           to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Vista pública
--
-- Se AÑADEN rating y rating_matches al final: create or replace view solo admite
-- agregar columnas nuevas conservando el orden previo (ver 0026, 0034).
-- rating_matches viaja con el rating a propósito: en la Jornada 1 los 69 varones
-- comparten el número exacto de su semilla, y la UI necesita poder decir "aún sin
-- partidos" en vez de parecer rota. rating_seed NO se expone: es dato de gestión.
-- ---------------------------------------------------------------------------
-- LISTA DE ESPERA: el organizador decidió que quien no tiene equipo NO sale en el
-- ranking público. Se hace aquí y no filtrando en la UI porque 7 de las 88
-- puntuadas están en lista de espera, y para ellas el número publicado no sería
-- algo ganado en cancha sino la valoración privada del organizador. El rating se
-- CONSERVA en players (no se pierde) y reaparece solo si entran a un equipo.
-- RatingChip ya devuelve null cuando no hay rating, así que la UI no cambia.
create or replace view players_public as
select id, season_id, team_id, full_name, gender, category_code,
       is_captain, is_active, photo_url, is_waitlisted, position, is_cocaptain,
       case when is_waitlisted then null else rating end as rating,
       rating_matches
from players
where is_active = true;

grant select on players_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. CARGA INICIAL DE SEMILLAS (2026-07-18, antes de la Jornada 1)
--
-- 88 ratings dictados por el organizador + 95 sembrados por categoría = 183.
-- Los 88 se cotejaron uno a uno contra players por nombre (el dictado traía
-- erratas reales: Gurierrez->Gutierrez, Murtillo->Murillo, Feliz->Félix,
-- Cazarez->Cazares, Prisilla->Priscilla, y varios apellidos maternos ausentes).
-- El cotejo se verificó con tres revisiones independientes y una reproducción
-- propia: 89 nombres -> 89 player_id DISTINTOS, 0 ambiguos, 0 sin emparejar,
-- suma de control 130919.
--
-- Liliana Grijalva se dictó SIN número: entra por semilla de categoría (FEM_4).
-- Ningún varón trae rating dictado: los 69 arrancan en la semilla de su categoría,
-- así que en la Jornada 1 todos los partidos masculinos parten de E = 0.500.
--
-- Idempotente: re-ejecutar la migración deja exactamente el mismo estado y no
-- revierte ediciones posteriores del organizador.
--
-- La tabla temporal se crea y se destruye con DROP explícito (no con
-- `on commit drop`) para que funcione igual si el SQL Editor corre el script
-- como una sola transacción o si hace autocommit por sentencia.
-- ---------------------------------------------------------------------------
drop table if exists _rating_dictado_0039;

create temporary table _rating_dictado_0039 (
  player_id uuid primary key,
  rating    numeric not null
);

insert into _rating_dictado_0039 (player_id, rating) values
  ('13798594-bc72-4d53-a335-63c0d2ac3834', 2061),  -- Alejandra García (FEM_3)
  ('2996c6da-3ef5-4588-a353-6c27414b00a3', 2436),  -- Alma Huguette de Alba (FEM_3)
  ('0d95712d-7edc-4330-8c0c-b9c28f7f38b0', 2072),  -- Carolina Treviño (FEM_3)
  ('48b1bdb7-4467-4e0c-984e-b098f6be7a9a', 2066),  -- Griselda Oaxaca Molinar (FEM_3)
  ('799f7da6-909b-450d-b7fc-221bce74c414', 2188),  -- Laura Lozoya (FEM_3)
  ('07efa173-034b-4b1c-a1de-260f130a979e', 2040),  -- Lili Avalos (FEM_3)
  ('c2d0d2cf-1149-4106-bc7e-eadb03c9cbff', 2245),  -- María Fernanda Prado (FEM_3)
  ('3a6dcd31-97d6-4d48-9df3-4fc61dfc3c1f', 2171),  -- Mónica Hernandez (FEM_3)
  ('5b744019-bd76-4d25-adba-d668ee315e26', 2062),  -- Paola López (FEM_3)
  ('36eee2ec-09be-487a-b42a-8502ff2c7e32', 2165),  -- Sara Hernandez (FEM_3)
  ('a0981a9d-63f5-4751-b37e-c8c00b545c6e', 1985),  -- Adriana Haro (FEM_4)
  ('e8c36b72-b79d-4f53-ae24-c4e37c0aaf7a', 1827),  -- Alejandra Contreras (FEM_4)
  ('2e921d12-38f0-4dee-a85d-2fd0046f793d', 1857),  -- Ana Escarcega (FEM_4)
  ('7be0935e-86db-4e02-abd6-a78c83740972', 1935),  -- Andrea Dávila (FEM_4)
  ('23881b66-8a49-4de5-8a63-b553ba736ddb', 1560),  -- Andrea García (FEM_4)
  ('f9f190ed-bb0a-48ce-b544-437fd11ae7ff', 1778),  -- Anilú Gaytán (FEM_4)
  ('baeb5a35-0c02-4606-a911-15d3ded6e19e', 1781),  -- Blanca Ramos (FEM_4)
  ('cbb66239-0819-49f8-aca2-b5ed0d7a4e2a', 1819),  -- Daniela Rodríguez (FEM_4)
  ('0d6a3ff3-81ef-4cd5-a6c2-49cd1a0b1f65', 1589),  -- Dayana Peña (FEM_4)
  ('e3cfabc6-e724-4010-9a2a-6eb6e468e096', 1629),  -- Janeth Carbajal (FEM_4)
  ('94efdb66-c3b4-41e3-910f-4884d1cf5cf2', 1855),  -- Laura García Gardea (FEM_4)
  ('d94c6e66-cb1d-44cf-8db2-2d000ddce87e', 1703),  -- Liliana Rodríguez (FEM_4)
  ('88cf3ff3-b7ad-4601-88de-867681c9edfb', 1558),  -- Lydia Juárez (FEM_4)
  ('fe36344f-dfa5-4fff-b071-34ee22b7168a', 1611),  -- Maria Renee Gonzalez (FEM_4)
  ('10e6e0d7-54ab-4d17-99ce-96e755d9fcea', 1661),  -- Morena Marrufo (FEM_4)
  ('5d812361-e100-4d3e-8d86-557cd704869a', 1733),  -- Nidia Shamira Gutierrez Barajas (FEM_4)
  ('06722f8e-e8cd-4095-b8ac-bb17a3121ee2', 1976),  -- Paola Lozano (FEM_4)
  ('c0efa3f0-d568-42c9-b4d4-d08e48bda31c', 1703),  -- Paola Rodríguez (FEM_4)
  ('8157df01-2a15-4667-a287-fbe7272f4b28', 2028),  -- Paulina Labrado (FEM_4)
  ('745d0ba9-300a-405d-8394-e125656d0c04', 1444),  -- Samantha Garza (FEM_4)
  ('4b5eba6a-0143-42ba-ab58-27c55583dcbe', 1608),  -- Sofía Payán (FEM_4)
  ('51439dc2-bda7-4382-b698-f8052e4d0e02', 1755),  -- Violeta Fierro Gonzalez (FEM_4)
  ('91ca35f1-c6e1-426b-8063-1f73f9adc7cc', 1715),  -- Zayra Azaeta (FEM_4)
  ('6f1156ab-633f-4df9-9da8-71ed6bca466e', 1469),  -- Almendra Robles (FEM_5)
  ('6ce41519-6878-4250-bcf1-586dabe0e6f3', 1506),  -- Amelia Melendez (FEM_5)
  ('dd2ac7b5-bebe-4654-b6b8-a0f49bbc13e3', 1403),  -- Astrid  Buenrostro (FEM_5)
  ('bfb1d406-76be-42b8-a0ae-a4b440cdc0bc', 1559),  -- Brenda Rodallegas (FEM_5)
  ('c81e6ec3-bf54-4a9d-abfe-bf85e7a4ed71', 1655),  -- Claudia Hinojos (FEM_5)
  ('f72259f4-d5d4-4620-ad39-adadba744445', 1536),  -- Cris Amaro (FEM_5)
  ('3d6d8af7-4ea6-4d14-b0a5-6c752b16ff07', 1358),  -- Cristina González (FEM_5)
  ('9f38c823-aadf-45b6-bec9-fb70c625bdad', 1622),  -- Elizabeth Murillo (FEM_5)
  ('510c9012-f846-4b1e-b34d-1f7354dafb59', 1379),  -- Frida Martinez (FEM_5)
  ('edd7bbde-385d-4774-96d3-e753cf04ba51', 1508),  -- Gabriela Garcia (FEM_5)
  ('b99b2cf8-5068-4e2e-b363-3bf67b41a42c', 1153),  -- Giselle Gamez (FEM_5)
  ('a4d6dc60-c2ef-4400-b1ea-7c43a5406c30', 1474),  -- Jenny Sáenz (FEM_5)
  ('4ffb456c-8c4c-4e80-9591-b0b2cd9ce376', 1250),  -- Liz Magallanes (FEM_5)
  ('c557bee5-7ec7-4176-a8df-76b6d910713e', 1672),  -- Marian Davila (FEM_5)
  ('9001eb51-e0c7-4e76-b4c1-9af4f4bd6675', 1566),  -- Martha Reyes (FEM_5)
  ('8e428114-1911-4809-94fb-8a8e7cb72af0', 1306),  -- Michelle Gamez (FEM_5)
  ('69bf4e07-867e-46c6-82f5-5ad6aa528c07', 1552),  -- Mily Hernandez (FEM_5)
  ('0066a10e-b752-47d1-9a80-6a3455c1521e', 1368),  -- Mitzi Valdes (FEM_5)
  ('a1a542f4-5e43-4a1a-a2ab-d81c53be0d21', 1618),  -- Silvia Félix (FEM_5)
  ('b33e4dd8-4a51-4d31-a7c7-36547a44ddc1', 1159),  -- Sophia Ortiz (FEM_5)
  ('d95dedf4-008e-44d4-958c-3f6abfb40cc3', 1351),  -- Thelma Hernandez (FEM_5)
  ('477c4cd2-31a6-4b7c-baf3-bfe7f59bf991', 1249),  -- Yanery Cazarez (FEM_5)
  ('66bc2f60-03a7-4e81-8b9e-9ba0b333021e', 923),  -- Adriana Cabrera (FEM_6)
  ('22f52467-81a9-4040-8e88-63c66456bf16', 855),  -- Alejandra Hernandez (FEM_6)
  ('d42bb210-ca9f-4f65-b6f8-1bb37b341dee', 1094),  -- Alma Rivero (FEM_6)
  ('6d9f76d2-fa60-4541-8796-c763d99c2979', 1076),  -- Ana Laura Portillo (FEM_6)
  ('0cfe90ab-6bde-4c68-b27e-a7db9e0647f6', 1132),  -- Analucía Prado (FEM_6)
  ('51014a31-0fe1-4328-bd78-6da681fd774d', 1645),  -- Andrea Barragan (FEM_6)
  ('8a11b78e-9039-4949-878e-0043c245f41c', 984),  -- Betsabé Urita (FEM_6)
  ('73bd099a-b25e-4d04-9ef1-e762b14b380f', 1550),  -- Bibiana Del castillo (FEM_6)
  ('414602e7-6fa1-4f65-ad1f-7d1c57093b0d', 1146),  -- Celeste Zapata (FEM_6)
  ('f6bb8b4f-3f26-4ab7-8d6b-2517b0736dcd', 1228),  -- Cris Hernandez (FEM_6)
  ('fc040203-4c91-4b6e-8a6f-eefe6625269c', 1298),  -- Cristina Peláez (FEM_6)
  ('99513a90-182e-45b9-914e-2aefd51cbd2f', 1189),  -- Dalia Garcia (FEM_6)
  ('a28af459-4a0e-4f40-9e62-870524b031d6', 1030),  -- Daniela Gallardo (FEM_6)
  ('881877b5-247d-4345-95e7-a4bff3b772f7', 1061),  -- Gabriela Melgar (FEM_6)
  ('7c894bdc-cca0-4775-a8f9-00ae39c31028', 1314),  -- Gabriela Silva (FEM_6)
  ('86d9a194-4095-4014-9c07-87cf8343302a', 1068),  -- Georgina Anchondo Sáenz (FEM_6)
  ('7f8dcdd4-087c-4165-b03e-96ff193e68f2', 1030),  -- Iris Guillén (FEM_6)
  ('cc0af089-ab99-49e2-9d05-55cfb7077413', 935),  -- Laura Baeza (FEM_6)
  ('bbc96596-ffbe-440c-82cf-835137795e96', 1446),  -- Mara Nevarez (FEM_6)
  ('74b4a4ad-2630-40a3-ba72-f10d7574ea93', 1302),  -- Marcela Barraza (FEM_6)
  ('27496059-7f92-49be-ae82-827c6ed6a426', 1067),  -- Mia Gonzalez (FEM_6)
  ('62c9ee45-61a6-4ac1-ac6b-3c78b85f22aa', 1152),  -- Nadia Salas (FEM_6)
  ('995c5bcb-cb5b-4ba0-b2c5-70b6031ae5d0', 1286),  -- Nidia Armendáriz (FEM_6)
  ('0b9ed370-fbc4-43ef-87ce-afdc5879cfcb', 1498),  -- Paola Cazares (FEM_6)
  ('5bae783c-d365-4b9c-9db1-42b4ccc91892', 1383),  -- Priscilla Lozano (FEM_6)
  ('6a1b752a-373f-4024-b975-a4cc7142884a', 1282),  -- Sandra Loya (FEM_6)
  ('124109cf-0ff0-41ad-917c-550e196491c0', 1026),  -- Tamahara Duarte Valdiviez (FEM_6)
  ('68a2cdab-bf92-4320-ae5c-81611b500423', 1170),  -- Tana Otamendi (FEM_6)
  ('3c42cf8c-8e78-4401-9d1b-a7cff231feff', 1034),  -- Ale Valdez (FEM_7)
  ('c0ae9e8d-924a-44ea-9810-c62f92c2a18a', 1071),  -- Berenice Guerrero (FEM_7)
  ('607ee9d3-26e8-466e-b77f-dceeb5afeaf5', 796),  -- Cindy Urita (FEM_7)
  ('4a0e28b1-3840-42c7-b85c-1455cc9fbe76', 704),  -- Damaris gallegos (FEM_7)
  ('a2c996e9-e234-4a60-aaae-89531a0935dd', 815)   -- Laura Olivas (FEM_7)
;

do $$
declare
  v_dictados int;
  v_suma     numeric;
  v_faltan   int;
  v_sin_semilla int;
begin
  -- Guardas: si el cotejo no cuadra con lo verificado, aborta ENTERA y sin haber
  -- tocado players. Es preferible no cargar nada a cargarle el rating de una
  -- jugadora a otra.
  select count(*), sum(rating) into v_dictados, v_suma from _rating_dictado_0039;
  if v_dictados <> 88 or v_suma <> 130919 then
    raise exception 'Rating abortado: se esperaban 88 filas y suma 130919; llegaron % filas y suma %',
      v_dictados, v_suma;
  end if;

  select count(*) into v_faltan
    from _rating_dictado_0039 d
    left join players p on p.id = d.player_id
   where p.id is null;
  if v_faltan > 0 then
    raise exception 'Rating abortado: % player_id del cotejo no existen en players', v_faltan;
  end if;

  -- (a) Los 88 dictados por el organizador.
  --     Igual que (b), solo toca a quien AÚN NO tiene semilla. Si el organizador
  --     corrige a mano el rating de una jugadora, re-ejecutar la migración NO se
  --     lo revierte. Sin este guard, un re-run dejaría rating_seed con el valor
  --     viejo y rating con el editado: exactamente la desincronización que el
  --     encabezado de esta migración declara imposible.
  --     Correcto ante fallos: (a) corre ANTES que (b), así que si el script se
  --     interrumpe y se re-ejecuta, los 88 ya están bien y (b) rellena el resto.
  update players p
     set rating_seed        = d.rating,
         rating_seed_source = 'dictado'
    from _rating_dictado_0039 d
   where p.id = d.player_id
     and p.rating_seed is null;

  -- (b) El resto, por categoría. Solo toca a quien AÚN NO tiene semilla, así que
  --     re-ejecutar no pisa una edición posterior del organizador.
  update players p
     set rating_seed        = cs.seed,
         rating_seed_source = 'categoria'
    from rating_category_seeds cs
   where p.category_code = cs.category_code
     and p.rating_seed is null;

  -- (c) Rating vigente = semilla mientras no haya partidos. Nunca pisa a quien ya
  --     tenga historia (rating_matches > 0): eso lo recalcula el motor.
  update players
     set rating = rating_seed
   where rating is null
     and rating_seed is not null
     and coalesce(rating_matches, 0) = 0;

  -- Comprobación final: nadie activo puede quedarse sin semilla. Si alguien tiene
  -- una category_code fuera de rating_category_seeds (p. ej. una categoría nueva
  -- sin semilla definida), esto lo saca a la luz en vez de dejarlo en null.
  select count(*) into v_sin_semilla
    from players where is_active = true and rating_seed is null;
  if v_sin_semilla > 0 then
    raise exception 'Rating incompleto: % jugadores activos quedaron sin semilla (¿categoría sin fila en rating_category_seeds?)',
      v_sin_semilla;
  end if;

  raise notice 'Rating sembrado: % dictados + resto por categoría.', v_dictados;
end $$;

drop table if exists _rating_dictado_0039;
