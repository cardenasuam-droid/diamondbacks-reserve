-- 0048_lineup_deadline_j6_exception.sql
-- Excepción puntual al límite de alineaciones, autorizada por la organizadora:
-- SOLO la jornada del viernes 28 de agosto de 2026 (jornada 6) tiene un límite
-- distinto — jueves 27 de agosto a las 08:00 hora de México (= 14:00 UTC) — en
-- lugar del sábado anterior 07:00, que para una jornada en viernes caería casi
-- una semana antes.
--
-- Todas las demás jornadas conservan la fórmula de 0035 intacta.
--
-- No hace falta tocar los triggers: enforce_lineup_lock (0035) y
-- enforce_entry_lock (redefinido en 0047) llaman a lineup_deadline() y heredan
-- el cambio automáticamente.
--
-- OJO: esta fecha está duplicada a propósito en el cliente
-- (src/features/lineups/lineupHelpers.ts → lineupDeadline). El servidor manda;
-- el cliente solo pinta el banner y deshabilita el botón. Si cambia una, cambia
-- la otra.
create or replace function lineup_deadline(p_round_date date)
returns timestamptz language sql immutable set search_path = public as $$
  select case
    -- Jornada 6 (viernes 28-ago-2026): jueves 27-ago 08:00 México.
    when p_round_date = date '2026-08-28'
      then timestamptz '2026-08-27T14:00:00Z'
    -- Regla general (0035): el sábado inmediatamente ANTERIOR, 07:00 México.
    -- extract(dow): 0=domingo .. 6=sábado. Días a retroceder hasta ese sábado
    -- (estrictamente antes): lunes(1)->2, domingo(0)->1, sábado(6)->7.
    else ((p_round_date
           - (case when (extract(dow from p_round_date)::int + 1) % 7 = 0
                   then 7
                   else (extract(dow from p_round_date)::int + 1) % 7 end) * interval '1 day')::date
          + time '07:00') at time zone 'America/Mexico_City'
  end;
$$;

-- Comprobación: la excepción y la regla general, tal como las verán los triggers.
do $$
begin
  if lineup_deadline(date '2026-08-28') <> timestamptz '2026-08-27T14:00:00Z' then
    raise exception 'J6: se esperaba 2026-08-27T14:00:00Z, se obtuvo %',
      lineup_deadline(date '2026-08-28');
  end if;
  -- Jornada normal en lunes: sábado dos días antes, 07:00 MX = 13:00 UTC.
  if lineup_deadline(date '2026-09-21') <> timestamptz '2026-09-19T13:00:00Z' then
    raise exception 'Jornada normal: se esperaba 2026-09-19T13:00:00Z, se obtuvo %',
      lineup_deadline(date '2026-09-21');
  end if;
  raise notice 'lineup_deadline: excepción J6 (jue 27-ago 08:00 MX) + regla general OK.';
end $$;
