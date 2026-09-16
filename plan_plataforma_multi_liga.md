# Plan: plataforma multi-liga Diamondbacks

**Fecha:** 2026-09-16 · **Versión 2** (incorpora las decisiones del organizador y
el formato real de la liga femenil, reconstruido desde las hojas de cálculo de
la 5a edición en Drive) · **Estado:** propuesta para revisión — no se ha
escrito código.

**La visión (en palabras del organizador):** una plataforma de ligas y torneos
donde **las usuarias perduran una vez inscritas** — perfil, estadísticas y
rating las siguen entre competencias — y donde al entrar se elige **qué liga o
torneo** ver, y dentro de él, **qué edición** (las ligas y torneos son
multi-edición). La próxima liga femenil es la siguiente edición de la Liga
Diamondbacks (7a, por confirmar) y sus inscripciones deben abrir ya.

---

## 1. Decisiones ya tomadas (2026-09-16)

1. **Formato de la liga femenil:** americano individual — 8 jornadas de fase
   regular con pareja rotativa asignada por jornada; después, **parejas fijas
   formadas por resultados** para playoffs. Es una nueva edición de la Liga
   Diamondbacks de siempre (la app vieja sirvió la 5a edición).
2. **Historial de la liga vieja:** no se rescata como backend; si se importa,
   es **solo como historial de juegos y estadísticas** por jugadora. La fuente
   ya está localizada: las hojas de Drive (ver §2.3) — no hace falta tocar la
   app vieja.
3. **Rating:** las jugadoras que estén en Reserve entran con **su rating de
   Reserve** (vía la capa de personas); a las que no estén, el organizador les
   dicta rating después.
4. **peak-padel queda aparte.** Solo se copia el patrón que vale oro: **subir
   comprobante de pago** en la inscripción, con revisión del organizador.
5. **Fechas:** jornadas los **lunes**, empezando en octubre (día exacto
   pendiente; el primer lunes de octubre de 2026 es el día 5). Inscripciones:
   cuanto antes.

---

## 2. Diagnóstico de lo que existe

### 2.1 Este repo + proyecto Supabase "Diamondbacks Reserve" (`qckqjrffrarktosixzdf`)

- 48 migraciones, una temporada (`Team League 2026`, activa). **Última jornada
  calendarizada: 28-sep-2026.** Cifras: 188 fichas, 160 cuentas, 330 partidos,
  1,048 eventos de rating. Base de datos: **24 MB**.
- El esquema ya es multi-temporada de fábrica (todo cuelga de `seasons`), pero
  no existe "liga" por encima de la temporada ni "persona" por encima de la
  ficha.
- El frontend tiene un solo cuello (`useActiveSeason`) en ~28 páginas: el
  refactor de contexto es barato.
- **Identidad (el nudo):** la cuenta (`profiles`) está soldada 1:1 a la ficha
  de UNA temporada (`profiles.player_id` + email sintético por ficha). Esto
  revienta incluso sin multi-liga: en la siguiente temporada de Reserve las
  fichas serán filas nuevas. El refactor de identidad era inevitable.
- **Rating:** ELO materializado, recálculo total determinista (semilla +
  ajustes + resultados → historia completa reproducible), escala absoluta
  entre géneros. El motor modela **pareja vs pareja por partido** — encaja sin
  cambios conceptuales con el americano, donde cada juego es 2v2.
- **Inscripciones:** `player_registrations` (bandeja pública con `season_id` y
  revisión del comité) sirve de base; le faltan los campos del formato
  femenil y el comprobante de pago (§5).

### 2.2 La cuenta de Supabase (org "Diamondbacks", **plan Pro**)

| Proyecto | Qué es |
|---|---|
| Diamondbacks Reserve | esta app — aquí vivirá la plataforma |
| peak-padel | torneo por parejas (aparte por decisión; se copia su patrón de comprobantes) |
| summit-gym | app personal ajena |

### 2.3 La liga femenil anterior — reconstruida desde Drive (ya no hay incógnita)

La app vieja (`diamondbacksleague.netlify.app`, deploy por CLI del 23-may-2026,
sin repo Git) leía su estado de una **hoja de cálculo en la nube** vía Netlify
Functions. La red de este entorno bloquea ese dominio, pero no hizo falta: las
hojas están en el Drive del organizador y de ahí salió el modelo completo:

- **`Diamondbacks 5a calculos`** (modificada 24-may-2026, un día después del
  último deploy — es la fuente que la app leía): roster, calendario,
  resultados, tablas por categoría y penalizaciones de la 5a edición.
- **`Liga Diamondbacks 5a Edicion (respuestas)`**: el formulario de
  inscripción (Google Forms) con los campos exactos que el calendario
  necesita.
- También existen `Diamondbacks 4a calculos`, `Diamondbacks 3a edición
  encuesta`, `Pago Diamondbacks 5a` y `Liga Diamondbacks` (2024) — el linaje
  completo por si algún día se quiere más historial.

**El formato, tal como se jugó la 5a edición (~138 jugadoras):**

- Inscripción **individual** con: nombre (como aparecerá en la app), categoría
  **3a–7a** (mapa directo a FEM_3…FEM_7, que ya existen en Reserve), fecha de
  cumpleaños, talla de playera, horarios que NO puede jugar (18:00 / 19:15 /
  20:30 / 21:45), días disponibles y **semana de descanso** elegida.
- **Calendario:** 8 jornadas por jugadora repartidas en ~9 semanas (una semana
  de descanso c/u). Cada juego reúne a **4 jugadoras de la misma categoría**
  (2v2 a 2 de 3 sets); la pareja te la asigna el calendario y **rota cada
  jornada**. Canchas 1–4, bloques 18:00–21:45. La 5a fue lunes y martes; la
  nueva será solo lunes.
- **Tabla individual por categoría:** puntos por partido (3/1/0 — mismo esquema
  que Reserve, con el punto de consolación por perder en 3 sets), y desempates
  dif. de partidos → dif. de sets → dif. de juegos. Existen **penalizaciones**
  (puntos restados a una jugadora, con motivo).
- **Playoffs:** al cerrar la fase regular se forman **parejas fijas según
  resultados** y juegan la fase final por categoría.
- Detalle operativo heredado: sustituciones se resolvían editando nombres en
  la hoja; la plataforma debe registrarlas como es debido (quién entró por
  quién) porque afectan rating y estadísticas.

### 2.4 Numeración de ediciones

Drive documenta 3a (2025), 4a (2025-26) y 5a (mar–may 2026, la de la app). No
hay rastro de una "6a" femenil; la cadencia (~2 por año) sugiere que la **Team
League 2026 (Reserve, jul–sep) ocupa el lugar de la 6a** en la cuenta del
organizador — lo que haría de la nueva femenil la **7a**, como él recuerda.
**Por confirmar** antes de publicar textos ("7a edición") en la app.

---

## 3. ¿Soporta la cuenta de Supabase la ampliación? — Sí, sobrada

- Plan **Pro**; Reserve usa 24 MB de los 8 GB incluidos por proyecto y ~160
  cuentas de 100,000 MAU. Todas las ligas de los próximos años caben sin
  rozar un límite.
- El costo marginal en Pro va por **proyecto activo** (cómputo), no por datos:
  por eso la plataforma vive **dentro del proyecto de Reserve** (costo extra
  $0). Un proyecto por liga costaría ~10 USD/mes cada uno y fragmentaría la
  identidad — lo contrario del objetivo.
- Salvaguardas: backups diarios de Pro verificados antes de la migración de
  identidad; ensayo en branch/dev (CLAUDE.md §3.1); migraciones numeradas,
  nunca editadas.
- Netlify: un solo sitio (diamondbackspadel.org) y una sola PWA para todas las
  ligas.

---

## 4. Arquitectura objetivo

### 4.1 Contenedores: `leagues` → `seasons` (ediciones)

La jerarquía pedida es explícita: **liga/torneo → edición**. `seasons` pasa a
ser "la edición" y gana `league_id`.

```sql
create table leagues (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,          -- 'reserve', 'femenil'
  name       text not null,                 -- 'Liga Diamondbacks (femenil)'
  kind       text not null,                 -- 'team_league' | 'americano' | 'tournament'
  theme      jsonb,
  sort_order int not null default 0,
  is_active  boolean not null default true
);
alter table seasons add column league_id uuid references leagues(id);
alter table seasons add column edition_number int;      -- 7 para la nueva femenil
alter table seasons add column slug text;               -- '7a-edicion' (URL)
-- backfill: liga 'reserve' → Team League 2026; liga 'femenil' → nueva edición.
```

`season_categories (season_id, category_code)`: qué categorías juega cada
edición (la femenil: FEM_3…FEM_7). Data-driven, como
`category_eligibility_rules`.

### 4.2 Identidad: `persons` — la pieza central

```sql
create table persons (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null,
  gender         gender_type not null,
  phone          text,                -- privado (RLS); llave práctica del cotejo
  email          text,
  birthdate      date,                -- privado; lo aporta la inscripción femenil
  photo_url      text,
  rating         numeric,             -- rating global vigente (ver 4.3)
  rating_matches int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table players  add column person_id uuid references persons(id);
alter table profiles add column person_id uuid unique references persons(id);
```

- `players` sigue siendo la ficha deportiva de una edición; solo gana su
  `person_id`. El motor de Reserve no se toca.
- **La cuenta pasa a ser de la persona.** Claim: eliges liga → roster → tu
  nombre → últimos 4 del teléfono; si tu persona ya tiene cuenta (por otra
  liga), es **login con tu contraseña de siempre**, no un alta nueva. Emails
  sintéticos nuevos por `person_id`; las 160 cuentas existentes no se tocan.
- **Cotejo nunca ciego:** dedupe por teléfono normalizado + nombre, con cola
  de revisión del organizador (fusionar/separar) para ambigüedades. Aplica
  igual al backfill de Reserve (188 fichas) y al cruce con las inscritas de la
  femenil. Una fusión errónea es el peor bug posible de la plataforma; se
  diseña para que no ocurra sin un humano.

### 4.3 Rating y estadísticas de por vida

- El rating canónico vive en `persons`; los eventos ganan `person_id` y el
  recálculo total ordena los partidos de **todas las competencias** por fecha
  real. Mismo motor, mismo espíritu (nada editable a mano salvo semillas y
  ajustes auditados).
- **Siembra de la femenil (decisión #3):** quien tenga ficha en Reserve entra
  con su rating vigente (la conexión la da `person_id`); a las demás, semilla
  por categoría al inscribirse y el organizador **dicta** las que quiera
  corregir antes de la J1 (mismo mecanismo auditado de 0039).
- `moves_rating` / `k_multiplier` por edición (data-driven): la liga femenil
  mueve rating completo; un torneo relámpago podría pesar menos o nada.
- El americano alimenta el motor tal cual: cada juego 2v2 es un evento por
  jugadora con rating de pareja vs pareja — exactamente lo que el motor ya
  calcula en Reserve.
- **La ficha de por vida** agrega sobre todas las fichas de la persona:
  competencias, PJ/PG, evolución de rating, títulos. Todo derivado; ninguna
  columna acumulada (CLAUDE.md §3.4).

### 4.4 Navegación: liga → edición

- **Landing = selector de ligas/torneos** (activas, próximas con "inscríbete",
  archivo). Con sesión: "tus ligas" primero.
- **Dentro de una liga, selector de edición**: por defecto la edición vigente;
  las anteriores quedan navegables como archivo (tabla, resultados,
  estadísticas de esa edición).
- URLs: `/l/<liga>/<edición>/...` (p. ej. `/l/femenil/7a/tabla`);
  `/l/<liga>` redirige a la edición vigente. Las URLs actuales redirigen a
  `/l/reserve/<edición-actual>/...` para no romper la PWA instalada.
- `useActiveSeason` → `useCompetition(ligaSlug, edicionSlug)`; query keys con
  el season_id. Recordar última liga/edición visitada (localStorage).
- Contenido (`news_posts`, `league_documents`, avisos): `league_id` nullable
  (null = de toda la plataforma).

### 4.5 El módulo americano (formato de la femenil)

Tablas nuevas, hermanas de las de Reserve (no se fuerza el modelo de equipos):

```
ind_matches         (id, season_id, round_id, category_code, court_id,
                     time_block_id, scheduled_at, phase 'regular'|'playoffs', status)
ind_match_players   (match_id, player_id, side 1|2)     -- 2 por lado
ind_match_results   (match_id, sets favor/contra ×3, winner_side, is_walkover, …)
ind_penalties       (season_id, player_id, points, reason, created_by, …)
season_pairs        (season_id, category_code, player_1_id, player_2_id)  -- parejas fijas de playoffs
```

- **Tabla individual por categoría:** vista SQL (`ind_standings`) con 3/1/0 y
  desempates dif. partidos → sets → juegos, menos penalizaciones — derivada,
  jamás almacenada. Tests obligatorios (es cálculo, el corazón de la app).
- **Generador de jornadas (la joya operativa):** con roster + restricciones de
  la inscripción (horarios bloqueados, días, semana de descanso) + historial
  de parejas, propone los juegos de 4 con cancha/horario. v1
  **semi-automático**: propone, el organizador ajusta y publica (paridad con
  lo que hoy hace la hoja de cálculo, sin prometer un solver perfecto).
- **Sustituciones** registradas (quién entró por quién, en qué juego): afectan
  rating y estadísticas, y en la hoja vieja eran invisibles.
- **Playoffs:** al cerrar la regular, el organizador forma parejas fijas desde
  la tabla (`season_pairs`) y los juegos de playoffs son `ind_matches` fase
  'playoffs' entre parejas fijas.

### 4.6 Inscripción femenil (formulario v2 del actual `/registro`)

Campos, calcados del formulario real de la 5a edición + pagos:

- nombre (como aparecerá en la app), categoría solicitada (FEM_3…FEM_7 desde
  `season_categories`), teléfono (privado), fecha de cumpleaños, talla de
  playera, **horarios que NO puede jugar**, **días disponibles** (esta edición:
  lunes — el campo queda por si vuelven ediciones de dos días), **semana de
  descanso**, comentario.
- **Comprobante de pago** (patrón peak-padel): subir imagen/PDF a un bucket
  **privado** de Storage; `payment_status` + revisión del organizador con
  fecha y quién validó. RLS: la inscrita sube el suyo; solo organizador/viewer
  leen.
- Todo cae en `player_registrations` (columnas nuevas + `availability jsonb`),
  status pending → el comité aprueba y crea la ficha (`players`) como hoy.

---

## 5. Plan por fases

El orden protege dos fechas: **inscripciones ya** y **J1 el primer lunes de
octubre**. La clave de secuenciación: gracias al recálculo total determinista,
**el rating puede aparecer a mitad de liga** — la J1 no depende de la capa de
personas ni del rating global; cuando esas fases aterricen, el recálculo
reconstruye las jornadas ya jugadas como si siempre hubieran estado.

| Fase | Qué entrega | Necesita | Ventana objetivo |
|---|---|---|---|
| **F1 — Liga creada + inscripciones abiertas** | `leagues` + edición femenil (draft), `season_categories`, formulario v2 (§4.6) con comprobante de pago, landing mínima "inscríbete", panel del organizador para revisar/aprobar con pagos | fechas y costo de inscripción; confirmar "7a" | **esta semana** — no toca tablas de la liga viva |
| **F2 — Módulo americano núcleo** | tablas §4.5, captura/edición de calendario por jornada, resultados, tabla individual por categoría (vista + tests), roster femenil desde inscripciones aprobadas | F1 | listo antes de la J1 (≈ 5-oct) |
| **F3 — Identidad `persons`** | tabla, backfill de Reserve + inscritas femenil con cola de cotejo, claim v2 (persona con cuenta → mismo login en todas las ligas) | cierre de Team League 2026 (28-sep) para el corte de auth | fin sep – med oct |
| **F4 — Selector liga→edición** | landing selector, `/l/<liga>/<edición>/...` + redirects, `useCompetition`, contenido por liga, dashboard multi-liga | F3 (para "tus ligas") | oct |
| **F5 — Rating global** | eventos con `person_id`, recálculo multi-competencia por fecha, siembra femenil (Reserve vía persona / dictado / categoría), ficha de trayectoria; tests de invariantes | F3; ratings dictados de las nuevas | oct – nov (retroactivo a J1 por recálculo) |
| **F6 — Generador de jornadas** | propuesta automática de juegos respetando disponibilidad/descansos/rotación de parejas; el organizador ajusta y publica | F2 | antes de la J2 idealmente; mientras, captura manual asistida |
| **F7 — Playoffs** | parejas fijas desde la tabla + fase final | F2 (y la recta final de la regular) | nov |
| **F8 — Historial 5a edición (opcional)** | import ligero desde las hojas de Drive: juegos y estadísticas por jugadora como archivo de solo lectura, cotejado a `persons`; **sin eventos de rating retroactivos** | F3 | cuando convenga |

Notas:

- F1+F2 van primero y no dependen del refactor: la femenil arranca aunque
  persons/selector lleguen dos semanas después (las rutas provisionales de la
  femenil se montan y luego se cuelgan del selector en F4).
- Cada fase = migraciones numeradas nuevas + tests de cálculo/validación +
  actualización de CLAUDE.md/PRODUCT.md al aterrizar (persons, claim v2, regla
  "ninguna fusión de personas sin revisión humana").
- peak-padel: fuera de alcance; solo se toma el patrón de comprobantes (F1).

## 6. Riesgos y contención

1. **Calendario apretado** (J1 ≈ 5-oct): por eso F2 es "núcleo jugable"
   (calendario manual + resultados + tabla) y el generador (F6) puede llegar
   en la J2 sin bloquear nada.
2. **Liga Reserve viva hasta el 28-sep:** F1/F2 no tocan sus tablas; el corte
   de auth (F3) se hace tras su última jornada.
3. **Fusión errónea de personas:** cola de revisión obligatoria, auditoría,
   operación de separar. Jamás merge automático de no-exactos.
4. **Rating contaminado:** la historia vieja no genera eventos; solo
   trayectoria visible (F8) y semillas dictadas auditadas.
5. **Un solo proyecto Supabase:** backups verificados antes de F3 + ensayo en
   branch/dev.

## 7. Pendientes del organizador (ya no bloquean el arranque, salvo el 1º)

1. **Fechas y costo:** día exacto de la J1 de octubre, fecha límite de
   inscripción, cuota y datos de pago (para el formulario y la landing).
2. **Confirmar numeración:** ¿la nueva femenil es la 7a? (Drive documenta
   hasta la 5a; encaja si la Team League cuenta como 6a.)
3. **Ratings dictados** de las jugadoras que no estén en Reserve — pueden
   llegar hasta antes de la J1 (F5 los aplica con el mecanismo auditado).
4. **Opcional:** si quieres que explore la app vieja visualmente (con el
   acceso que ofreciste), la red de este entorno necesita permitir ese
   dominio: en claude.ai/code → tu entorno → configuración de red, añade
   `diamondbacksleague.netlify.app` (o usa un entorno con red completa) y
   dímelo. Con las hojas de Drive ya reconstruí datos y formato, así que esto
   solo aportaría detalles de UI que quieras conservar.
