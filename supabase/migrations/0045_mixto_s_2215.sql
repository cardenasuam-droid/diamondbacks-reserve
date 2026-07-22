-- 0045_mixto_s_2215.sql
-- MIX_S (Mixto S) se mueve de las 10:15 a las 22:15.
--
-- El bloque de las 10:15 lo usaba EXCLUSIVAMENTE MIX_S (30 partidos, 3 canchas,
-- verificado en la BD), así que se mueve el bloque entero en vez de crear otro:
-- ningún partido cambia de bloque ni de cancha, y por tanto no hay forma de
-- violar el unique(round_id, time_block_id, court_id).
--
-- Con esto la jornada queda en una sola cadencia de 75 minutos —
-- 18:30 · 19:45 · 21:00 · 22:15 — en vez de un turno matutino suelto.
--
-- QUÉ NO SE VE AFECTADO (verificado antes de escribir esto):
--   · El límite para enviar alineaciones va por round_date (sábado 07:00,
--     lineup_deadline en 0035), no por la hora del partido.
--   · El unique de cancha+horario: el bloque conserva su id y sus canchas.
--   · report_match_result (0043) compara la fecha LOCAL del partido, así que un
--     partido de las 22:15 sigue perteneciendo al día de su jornada aunque en
--     UTC caiga en la madrugada siguiente.
--
-- OJO CON LA ZONA HORARIA: 22:15 en México (UTC-6 todo el año desde 2022, sin
-- horario de verano) es 04:15 UTC del DÍA SIGUIENTE. Por eso scheduled_at se
-- calcula convirtiendo la hora local, y no sumando horas a mano.

-- ---------------------------------------------------------------------------
-- 1. El bloque horario se mueve al final del día.
--    sort_order 4 lo coloca DESPUÉS de 21:00 (el rol ordena por sort_order);
--    dejarlo en 0 lo seguiría pintando como primer turno.
--    El `in ('10:15','22:15')` hace la migración re-ejecutable.
-- ---------------------------------------------------------------------------
update time_blocks
set label = '22:15', start_time = '22:15:00', sort_order = 4
where label in ('10:15', '22:15');

-- ---------------------------------------------------------------------------
-- 2. Los 30 partidos de MIX_S pasan a las 22:15 de su propia jornada.
--    Solo se escriben las filas que cambian (idempotente).
-- ---------------------------------------------------------------------------
update matches m
set scheduled_at = ((r.round_date + time '22:15') at time zone 'America/Mexico_City')
from rounds r
where r.id = m.round_id
  and m.category_code = 'MIX_S'
  and m.scheduled_at is distinct from
      ((r.round_date + time '22:15') at time zone 'America/Mexico_City');

-- ---------------------------------------------------------------------------
-- 3. Comprobación: los 30 partidos deben quedar a las 22:15 locales y no puede
--    quedar ninguno a las 10:15. Si algo no cuadra, revierte todo el bloque.
-- ---------------------------------------------------------------------------
do $$
declare
  v_ok   int;
  v_mal  int;
begin
  select count(*) into v_ok
  from matches m
  where m.category_code = 'MIX_S'
    and (m.scheduled_at at time zone 'America/Mexico_City')::time = time '22:15';

  select count(*) into v_mal
  from matches m
  where (m.scheduled_at at time zone 'America/Mexico_City')::time = time '10:15';

  if v_ok <> 30 or v_mal <> 0 then
    raise exception 'Cambio de horario abortado: % de 30 partidos a las 22:15 y % siguen a las 10:15',
      v_ok, v_mal;
  end if;

  raise notice 'MIX_S movido a las 22:15: % partidos.', v_ok;
end $$;
