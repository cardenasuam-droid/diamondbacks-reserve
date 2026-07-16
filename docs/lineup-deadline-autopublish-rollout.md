# Rollout — Límite de alineación (sábado 07:00) + cierre y publicación

Cambia el límite para enviar alineaciones y agrega el cierre de jornada con
publicación pública y autogenerado aleatorio. Dos migraciones + cliente.

## Qué cambia

1. **Límite = sábado 07:00 (hora de México) antes de la jornada** (antes: 1 h antes
   del primer partido). A partir de ese instante, solo el organizador edita.
2. **Cierre de jornada (organizador):** en *Organizador → Estado de alineaciones*,
   botón **"Cerrar y publicar jornada"** que:
   - genera una alineación **aleatoria válida** para cada equipo que NO envió
     (respeta género/categoría, mixtas 1+1 y "un jugador no juega dos categorías";
     roster corto → llena lo que puede y deja el resto vacío),
   - **publica** todas (quedan **visibles para todos** en el rol público `/rol`).

La generación aleatoria corre en el navegador del organizador (lógica en TS
testeada) y se guarda con `save_lineup` (el organizador salta el candado). El SQL
nuevo es mínimo: publicar = marcar `lineups.locked_at`.

## Aplicar (juntas, con el deploy del cliente)

1. `0035_lineup_deadline.sql` — `lineup_deadline(round_date)` + candados
   `enforce_lineup_lock`/`enforce_entry_lock` por la nueva hora.
2. `0036_publish_lineups.sql` — RPC `publish_round_lineups(round)` + RLS de lectura
   pública de alineaciones **publicadas** (`locked_at` no nulo) + grants a `anon`.
3. Deploy del cliente (esta rama) a Netlify.

Ambas son aditivas y seguras de correr antes del deploy (no rompen el cliente
actual). Las páginas públicas degradan sin errores si aún no se aplican.

## Uso (cada jornada)

El sábado ~07:00: Organizador → *Estado de alineaciones* → elige la jornada →
**Cerrar y publicar jornada** → confirma. Verás cuántas se autogeneraron (y cuántas
quedaron incompletas por roster corto) y cuántas se publicaron. Desde ese momento
cualquiera ve las parejas por categoría en `/rol`.

## Notas / decisiones

- **Un equipo con solo BORRADOR** cuenta como "no envió": se le autogenera
  (reemplaza el borrador). Si quieres preservar borradores parciales, es un ajuste
  posterior.
- **Re-ejecutar** el cierre es seguro: solo autogenera equipos aún sin envío y solo
  publica lo que no tenía `locked_at`.
- El candado por tiempo (sábado 07:00) NO necesita el botón: es automático vía
  trigger. El botón es para publicar + autogenerar (decisión: disparo manual del
  organizador, sin pg_cron).
