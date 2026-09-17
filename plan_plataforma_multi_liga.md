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

## 1. Decisiones ya tomadas (2026-09-16, actualizadas el mismo día)

1. **Formato de la liga femenil:** americano individual — 8 jornadas de fase
   regular con pareja rotativa asignada por jornada; después, **parejas fijas
   formadas por resultados** para playoffs. Es la **6a Edición** de la Liga
   Diamondbacks (confirmado por el organizador; la app vieja sirvió la 5a).
2. **Calendario de la 6a:** arranca el **lunes 12 de octubre de 2026**, 8
   lunes consecutivos (última jornada 30-nov). Las fechas van justas, así que
   la inscripción pregunta **disponibilidad de horarios, no de fechas** (no
   hay semana de descanso). Horarios: **6:30, 7:45 y 9:00 pm** (bloques
   18:30/19:45/21:00, que ya existían en el catálogo). **Cupo: 120 jugadoras**
   = 10 canchas × 3 horarios × 4.
3. **Identidad visual por liga:** cada liga tiene sus colores propios
   (`leagues.theme` + `[data-league]` en index.css). Femenil: **violeta +
   azul eléctrico sobre ónix-violeta**, derivada del wordmark "DIAMONDBACKS"
   del flyer de la liga pasada (`diamondbacks.jpg` en Drive, único material
   de marca localizado; la app vieja sigue inaccesible por red). El oro se
   conserva como acento del club en todas las ligas. Sujeta a revisión del
   organizador al verla desplegada.
4. **Historial de la liga vieja:** no se rescata como backend; si se importa,
   es **solo como historial de juegos y estadísticas** por jugadora. La fuente
   ya está localizada: las hojas de Drive (ver §2.3).
5. **Rating:** las jugadoras que estén en Reserve entran con **su rating de
   Reserve** (vía la capa de personas); a las que no estén, el organizador les
   dicta rating después.
6. **peak-padel queda aparte.** Solo se copió el patrón que vale oro: **subir
   comprobante de pago** en la inscripción, con verificación del organizador.

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

Drive documenta 3a (2025), 4a (2025-26) y 5a (mar–may 2026, la de la app).
**Confirmado por el organizador: la nueva femenil es la 6a Edición** — la
numeración sigue a la liga femenil americano, no cuenta a la Team League.

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
- **"Mi inscripción" (0057, 17-sep):** cada alta genera un token (enlace
  mágico, patrón peak-padel); `/registro/<liga>/estado` muestra la
  confirmación (nombre, categoría, fecha, pago verificado o no) y permite
  subir/reemplazar comprobantes después, hasta que el comité confirme el
  pago. El token se recuerda por dispositivo y el RPC nunca expone teléfono
  ni fecha de nacimiento.

---

## 5. Plan por fases

El orden protege dos fechas: **inscripciones ya** y **J1 el primer lunes de
octubre**. La clave de secuenciación: gracias al recálculo total determinista,
**el rating puede aparecer a mitad de liga** — la J1 no depende de la capa de
personas ni del rating global; cuando esas fases aterricen, el recálculo
reconstruye las jornadas ya jugadas como si siempre hubieran estado.

| Fase | Qué entrega | Necesita | Ventana objetivo |
|---|---|---|---|
| **F1 — Liga creada + inscripciones abiertas** · ✅ **HECHA (16-sep; 0049/0050 aplicadas al proyecto live)** | `leagues` + 6a Edición (12-oct, cupo 120, FEM_3–7, bloques 6:30/7:45/9:00 pm) con inscripción abierta; hub `/registro` multi-liga; formulario americano `/registro/femenil` (cumpleaños, veto de horarios máx. 2, talla, posición, comentario, comprobante a bucket privado); landing `/femenil` con tema por liga; banner en la Home; panel del organizador con pestañas por edición, cupo, comprobante (URL firmada) y verificación de pago; cupo 120 con trigger en el servidor. Pendiente: `payment_instructions` para encender la sección de pago | — | entregada |
| **F2 — Módulo americano núcleo** · ✅ **HECHA (16-sep; 0051 aplicada al proyecto live)** | ind_matches/players/results + ind_penalties + season_pairs con candados de servidor (temporada, una jugadora por jornada, choques de cancha, walkover coherente); vistas per_player_ind_match e ind_standings (3/1/0, consolación, walkover 12-0, penalizaciones, desempates de la 5a) con espejo TS y tests; 8 jornadas de la 6a sembradas (12-oct→30-nov, borrador); páginas públicas `/femenil/rol` y `/femenil/tabla`; panel `/app/organizador/liga/femenil` (publicar jornadas, juegos de 4, captura de resultados, penalizaciones). Falta: generador de jornadas (F6) y playoffs (F7) | F1 | entregada |
| **F3 — Identidad `persons`** | tabla, backfill de Reserve + inscritas femenil con cola de cotejo, claim v2 (persona con cuenta → mismo login en todas las ligas) | cierre de Team League 2026 (28-sep) para el corte de auth | fin sep – med oct |
| **F4 — Selector liga→edición** · ◐ **selector de entrada ENTREGADO (16-sep; endurecido 17-sep)** | Hecho: `/` manda SIEMPRE al selector `/ligas` para TODOS, con o sin sesión (decisión del organizador 17-sep: nada de liga recordada; cada apertura de la app arranca eligiendo liga); la portada de Reserve vive en `/inicio` (dashboard con sesión / Home pública) + "Cambiar de liga" en el menú de todas las áreas y en el cascarón femenil. Pendiente tras F3: rutas `/l/<liga>/<edición>`, `useCompetition`, contenido por liga, dashboard multi-liga | F3 (para "tus ligas") | oct |
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

## 7. Pendientes del organizador

1. **Pago: ACTIVO (17-sep).** `payment_instructions` de la 6a lleva el link de
   Mercado Pago y la CLABE HSBC; el formulario sube comprobante de pago y,
   opcional, el del torneo de Peak Padel (descuento $250, 0056). El cupo se
   cuenta por pagos verificados (`season_paid_count`). Cuota **$1,500 MXN**
   ($1,250 con descuento Peak) ya escrita en el texto. Con "Mi inscripción"
   (0057) la jugadora comprueba su alta y sube el comprobante después si no
   lo tenía al inscribirse.
2. **Colores femenil:** aplicados desde el flyer (violeta + azul). Revisar en
   el deploy y ajustar si no coinciden con el recuerdo; si existe el escudo
   real en algún archivo, con pasarlo se recalibra la paleta.
3. **Ratings de la liga pasada (Slicewin): DATOS COMPLETOS en staging.** El
   organizador exportó miembros (194, con correos — tabla privada
   `slicewin_members`, 0052) y partidos (634 con el cambio de Elo por jugadora
   y UID estable — tablas privadas `slicewin_players`/`slicewin_matches`,
   0053). Confirmado: los Elo INICIALES de Slicewin son la misma escalera que
   Reserve femenil. Por tanto F5 puede COMPUTAR el rating final de cada
   jugadora: semilla de su categoría (hoja de la 5a) + suma de deltas de sus
   partidos `validated_results` con `elo_applied` — y usarlo como semilla
   dictada auditada de la 6a, con cotejo por nombre/correo y revisión humana
   de ambiguos (hay homónimas y cuentas duplicadas en el export). Los datos
   personales NO viven en el repo público: solo en la base, tras RLS de
   organizador.
