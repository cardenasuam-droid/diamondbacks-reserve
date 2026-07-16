-- 0035_lineup_deadline.sql
-- Cambia el LÍMITE para enviar/editar alineaciones: de "1 hora antes del primer
-- partido" (0002) a una hora fija: el SÁBADO 07:00 (hora de México) inmediatamente
-- anterior a la jornada. A partir de ese instante, solo el organizador edita.
--
-- (La publicación automática + la generación aleatoria a esa hora van en una
-- migración/PR aparte; esto es solo el candado por tiempo.)

-- ---------------------------------------------------------------------------
-- Límite de una jornada: el sábado inmediatamente ANTERIOR a round_date, 07:00
-- America/Mexico_City. extract(dow): 0=domingo .. 6=sábado. Días a retroceder
-- hasta ese sábado (estrictamente antes): lunes(1)->2, domingo(0)->1, sábado(6)->7.
-- México no usa horario de verano desde 2023 (UTC-6 todo el año), pero
-- `at time zone` lo resuelve bien de cualquier forma.
-- ---------------------------------------------------------------------------
create or replace function lineup_deadline(p_round_date date)
returns timestamptz language sql immutable set search_path = public as $$
  select ((p_round_date
           - (case when (extract(dow from p_round_date)::int + 1) % 7 = 0
                   then 7
                   else (extract(dow from p_round_date)::int + 1) % 7 end) * interval '1 day')::date
          + time '07:00') at time zone 'America/Mexico_City';
$$;

-- ---------------------------------------------------------------------------
-- Candado sobre lineups: reemplaza el "1h antes del partido" (0002) por el límite
-- del sábado 07:00. El organizador nunca tiene candado.
-- ---------------------------------------------------------------------------
create or replace function enforce_lineup_lock()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_deadline timestamptz;
begin
  if is_organizer() then
    return new;
  end if;

  select lineup_deadline(r.round_date) into v_deadline
  from team_matchups tm
  join rounds r on r.id = tm.round_id
  where tm.id = new.team_matchup_id;

  if v_deadline is not null and now() >= v_deadline then
    raise exception
      'Alineación bloqueada: el límite fue el sábado 07:00 antes de la jornada.';
  end if;

  return new;
end;
$$;

-- Mismo candado sobre las entradas (la propiedad y la jornada se derivan del lineup).
create or replace function enforce_entry_lock()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_deadline timestamptz;
begin
  if is_organizer() then
    return new;
  end if;

  select lineup_deadline(r.round_date) into v_deadline
  from lineups l
  join team_matchups tm on tm.id = l.team_matchup_id
  join rounds r on r.id = tm.round_id
  where l.id = new.lineup_id;

  if v_deadline is not null and now() >= v_deadline then
    raise exception
      'Alineación bloqueada: el límite fue el sábado 07:00 antes de la jornada.';
  end if;

  return new;
end;
$$;
