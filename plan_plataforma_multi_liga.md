# Plan: plataforma multi-liga Diamondbacks

**Fecha:** 2026-09-16 · **Estado:** propuesta para revisión (no se ha escrito código)

Qué resuelve este documento: convertir la app de Reserve (una liga, una temporada)
en la plataforma de TODAS las ligas y torneos Diamondbacks, donde cada persona
conserva **una sola cuenta, un solo perfil, su trayectoria y su rating** entre
competencias; con una pantalla de inicio para elegir liga; y con las
**inscripciones de la próxima liga femenil abriendo cuanto antes**, sin esperar
al refactor grande. Incluye el análisis de capacidad de la cuenta de Supabase y
el rescate de la app anterior (`diamondbacksleague.netlify.app`).

---

## 1. Diagnóstico de lo que existe hoy

### 1.1 Este repo + proyecto Supabase "Diamondbacks Reserve" (`qckqjrffrarktosixzdf`)

- 48 migraciones, una temporada (`Team League 2026`, activa). **Última jornada
  calendarizada: 28-sep-2026** — quedan ~2 semanas de liga viva. Cifras: 188
  fichas, 160 cuentas, 330 partidos, 1,048 eventos de rating, 216 inscripciones.
  Base de datos: **24 MB**.
- El esquema ya es multi-temporada de fábrica: equipos, fichas, jornadas,
  partidos, alineaciones, resultados, rating e inscripciones cuelgan de
  `seasons` (directa o transitivamente). Lo que NO existe es el concepto "liga"
  por encima de la temporada, ni identidad de persona por encima de la ficha.
- El frontend tiene un solo cuello de botella (`useActiveSeason`): ~28 páginas
  se scopean a "la temporada activa". Eso abarata muchísimo el refactor — se
  cambia un hook, no sesenta páginas.
- **Identidad (el nudo real):** la cuenta (`profiles`) está soldada 1:1 a la
  ficha de roster (`players`) vía `profiles.player_id` + email sintético
  `<player_id>@players.diamondbackspadel.org`. La ficha es POR TEMPORADA
  (`players.season_id`). Consecuencia: esto revienta incluso sin multi-liga —
  en la temporada 2 de Reserve las fichas serán filas nuevas y las 160 cuentas
  apuntarían a fichas de una temporada muerta. El refactor de identidad no es
  un capricho multi-liga: ya era inevitable.
- **Rating:** ELO materializado con recálculo total determinista
  (semilla + ajustes + resultados → historia completa reproducible), escala
  absoluta entre géneros (FEM_5 = VAR_6 = 1500, etc.). Diseñado justo para un
  ranking global legible… pero anclado a `players`, o sea a una temporada.
- **Inscripciones:** `player_registrations` ya es una bandeja pública con
  `season_id`, revisión del comité y RLS correcta. Sirve tal cual para abrir
  la femenil apuntando a una temporada nueva.

### 1.2 La cuenta de Supabase (org "Diamondbacks", **plan Pro**)

| Proyecto | Qué es | Estado |
|---|---|---|
| Diamondbacks Reserve | esta app | 24 MB, sano |
| peak-padel | torneo por parejas: inscripciones por pareja con pagos y comprobantes, cupos por categoría, lista de espera, grupos, slots de cancha, check-ins (213 jugadoras, 123 inscripciones) | activo |
| summit-gym | app personal de gimnasio, ajena a la plataforma | activo |

El proyecto de la liga femenil anterior **no está en esta organización** de
Supabase (ver 1.3).

### 1.3 La app anterior (`diamondbacksleague.netlify.app`)

Lo que pude verificar desde Netlify:

- Deploy del 23-may-2026 **por CLI, sin repo de Git enlazado** → el código
  fuente muy probablemente solo vive en tu máquina.
- Arquitectura: SPA + 5 Netlify Functions — `padel-get` / `padel-save` (estado
  de la liga, casi seguro un documento JSON), `photo-proxy`, `push-subscribe`,
  `push-scheduler` (cron cada hora). Es decir: **sus datos viven detrás de
  `padel-get`**, no en un proyecto Supabase visible desde esta cuenta.
- Este entorno remoto tiene bloqueado el acceso de red a `*.netlify.app`, así
  que **no pude leer su contenido**. El rescate de datos requiere un paso tuyo
  (sección 7). El plan no asume nada sobre su formato interno; la fase de
  importación se detalla cuando tengamos el JSON.

---

## 2. ¿Soporta tu cuenta de Supabase la ampliación? — Sí, sobrada

- **Capacidad técnica:** el plan Pro incluye por proyecto 8 GB de disco y
  100,000 usuarios activos/mes. Reserve usa 24 MB y ~160 cuentas. Diez ligas de
  200 personas con años de historia seguirían siendo un redondeo. La capacidad
  NO es una restricción; el trabajo real es de esquema y auth, no de infra.
- **Dónde cuesta dinero:** en Supabase Pro el costo marginal va por **proyecto
  activo** (cómputo por instancia; el crédito incluido cubre aproximadamente
  uno), no por tamaño de datos a esta escala. Hoy pagas cómputo extra por tener
  3 proyectos activos.
- **Recomendación fuerte:** la plataforma multi-liga vive **dentro del proyecto
  existente de Reserve**. Costo marginal: $0. Un proyecto nuevo por liga costaría
  ~10 USD/mes cada uno y — peor — fragmentaría la identidad de las jugadoras,
  que es exactamente lo que quieres eliminar. Una base, un login, un rating.
- **Salvaguardas** (porque un solo proyecto = un solo radio de daño):
  - Antes de la migración de identidad (fase 2): verificar backups diarios de
    Pro (7 días incluidos) y valorar activar PITR ese mes.
  - Sigue vigente el plan de CLAUDE.md §3.1: cuando haya que ensayar una
    migración delicada, se ensaya contra un branch/entorno dev, no en prod.
- **Netlify:** un solo sitio (diamondbackspadel.org) sirve todas las ligas.
  Una PWA, un dominio, cero costo nuevo.

---

## 3. Arquitectura objetivo

### 3.1 Contenedores: `leagues` → `seasons`

Dos formas de modelarlo, y por qué elijo la primera:

- **(A) Tabla `leagues` arriba de `seasons`.** "Liga Femenil" es una entidad
  estable con slug, branding y archivo de ediciones; cada edición es un
  `seasons` con `league_id`.
- **(B) Cada `seasons` es una competencia suelta** con un campo `kind` y ya.
  Más barato hoy, pero "el historial de la Liga Femenil" se vuelve un LIKE
  sobre nombres, el selector de inicio listaría ediciones en vez de ligas, y el
  branding por liga no tiene dónde vivir.

Elección: **A**, en versión mínima. Una tabla y una FK hoy compran el selector
correcto, el archivo por liga y la puerta a staff por liga mañana.

```sql
create table leagues (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,          -- 'reserve', 'femenil'
  name       text not null,                 -- 'Liga por Equipos Reserve'
  kind       text not null,                 -- 'team_league' | 'pairs_league' | 'tournament'
  theme      jsonb,                         -- acentos de marca por liga (opcional)
  sort_order int not null default 0,
  is_active  boolean not null default true
);
alter table seasons add column league_id uuid references leagues(id);
-- backfill: 1 fila 'reserve' + UPDATE de la temporada existente; luego NOT NULL.
```

Además: `season_categories (season_id, category_code)` — qué categorías juega
cada temporada. Hoy el catálogo `match_categories` es global e implícito; la
femenil usará solo FEM_* y la página de inscripción necesita esa lista por liga.
Data-driven, como `category_eligibility_rules`.

### 3.2 Identidad: `persons` — la persona por encima de la ficha

La pieza central de todo el proyecto.

```sql
create table persons (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  gender      gender_type not null,
  phone       text,            -- privado (RLS), llave práctica del cotejo
  email       text,
  photo_url   text,
  -- rating global (ver 3.3)
  rating         numeric,
  rating_matches int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table players  add column person_id uuid references persons(id);
alter table profiles add column person_id uuid unique references persons(id);
```

- **`players` no cambia de significado:** sigue siendo la ficha deportiva de
  una temporada (roster, categoría, capitanía, rating de esa liga). Solo gana
  su `person_id`. Todo el motor deportivo actual queda intacto.
- **La cuenta pasa a ser de la persona, no de la ficha.** `profiles.person_id`
  sustituye (gradualmente) a `profiles.player_id`. El claim evoluciona:
  eliges liga → roster → tu nombre → últimos 4 del teléfono. Si tu persona ya
  tiene cuenta (por otra liga), la app te lo dice y es **login con tu contraseña
  de siempre**, no un alta nueva. Una contraseña para todas las ligas — el
  beneficio visible #1 para las usuarias.
- **Emails sintéticos:** los nuevos se derivan de `person_id`
  (`<person_id>@players.diamondbackspadel.org`). Las 160 cuentas existentes NO
  se tocan (su email por `player_id` sigue funcionando; el enlace correcto lo
  da `profiles.person_id`). Cero re-registro, cero pérdida de sesión.
- **Backfill con cotejo, nunca ciego:** las 188 fichas actuales se agrupan en
  personas por teléfono normalizado + nombre. Los casos ambiguos (homónimas,
  erratas — la migración 0039 documenta erratas reales: Gurierrez→Gutierrez,
  Feliz→Félix…) caen en una **cola de revisión del organizador** con "fusionar /
  separar". Lo mismo aplicará al importar la liga vieja y, si algún día entra,
  peak-padel. El fusionado silencioso de dos personas distintas es el peor bug
  posible de esta plataforma; se diseña para que no pueda pasar sin un humano.

### 3.3 Rating y estadísticas de por vida

- **El rating canónico se muda a `persons`.** La línea de tiempo de eventos se
  vuelve única por persona, ordenada cronológicamente **entre competencias**
  (los eventos ya guardan season/round/match; se añade `person_id` y el
  recálculo ordena por fecha real de partido). El motor no cambia de filosofía:
  sigue siendo semilla + ajustes + resultados → recálculo total determinista.
  Solo cambia el sujeto: la persona en vez de la ficha.
- **Semilla:** una persona se siembra UNA vez (al entrar al ecosistema, por
  categoría o dictado). Al inscribirse a una liga nueva ya no se resiembra:
  llega con su rating vigente. La escala absoluta FEM/VAR que ya calibraste es
  justo lo que hace esto coherente.
- **Peso por competencia:** tabla `season_rating_settings` (o columnas en
  `seasons`): `moves_rating boolean` + `k_multiplier numeric`. Una liga oficial
  mueve K completa; un torneo relámpago puede mover menos o nada. Data-driven,
  recalibrable sin deploy, mismo criterio que `rating_settings`.
- **`players.rating` queda como caché por temporada** (lo que esa liga muestra
  en sus vistas), regenerado por el mismo recálculo. `persons.rating` es el
  número global de la ficha de por vida.
- **Trayectoria:** la ficha pública de la persona agrega sobre todas sus fichas:
  competencias jugadas, PJ/PG, evolución del rating, títulos. Todo derivado de
  lo ya almacenado — ni una columna de stats acumuladas (CLAUDE.md §3.4).
- **Tests obligatorios** para el recálculo multi-competencia (invariantes:
  mismo resultado con recálculo desde cero; el orden entre ligas no depende del
  orden de inserción; una temporada con `moves_rating=false` no altera nada).

### 3.4 Navegación y pantalla de inicio

- **Landing = selector de ligas:** ligas activas (entrar), próximas (con botón
  de inscripción — la femenil vivirá aquí desde la fase 1) y archivo. Con
  sesión iniciada: "tus ligas" primero.
- **URLs por liga:** `/l/<slug>/...` — todas las rutas públicas actuales se
  montan bajo el slug (`/l/reserve/tabla`, `/l/femenil/rol`).
  `useActiveSeason` se convierte en `useCompetition(slug)` (liga + su temporada
  vigente) y las query keys incorporan el season_id. Redirects de las URLs
  actuales → `/l/reserve/...` para no romper enlaces guardados ni la PWA
  instalada.
- **Recordar la última liga** (localStorage): quien solo juega una liga entra
  directo, con un conmutador visible arriba. El dashboard personal muestra
  todas las fichas de la persona (una tarjeta por liga activa).
- Contenido (`news_posts`, `league_documents`, avisos): ganan `league_id`
  nullable — null = de toda la plataforma, con valor = de esa liga.
- Una sola PWA, un solo manifest; el tema (esmeralda/oro) es la marca madre y
  cada liga puede acentuar vía `leagues.theme` sin romper el design system.

### 3.5 Formatos de competencia

- **`team_league`** (Reserve): ya existe entero. Si la nueva femenil se juega
  POR EQUIPOS, montar su temporada cuesta casi nada: seed de categorías FEM,
  reglas de elegibilidad de esa liga y listo — todo el motor (rol, alineaciones,
  resultados, tabla, ranking, draft, waitlist) aplica tal cual.
- **`pairs_league` / `tournament`** (parejas → grupos → llaves, estilo
  peak-padel): requiere un módulo nuevo (inscripción por pareja, grupos,
  round-robin, slots, standings de grupo, llaves). Es perfectamente compatible
  con la arquitectura (todo scopeado por season_id), pero es el bloque de
  trabajo más grande del plan si la femenil lo necesita.
- **Decisión abierta #1 (bloqueante para fases 5+):** ¿la nueva liga femenil se
  juega por equipos o por parejas? El plan de inscripciones (fase 1) funciona
  igual en ambos casos; el formato decide lo que se construye después.

### 3.6 Roles y RLS

- `profiles.role` sigue siendo global mientras el staff sea el mismo en todas
  las ligas (tu caso hoy). Si mañana hay organizadores distintos por liga, se
  añade `league_staff(league_id, person_id, role)` — la puerta queda abierta,
  no se construye ahora.
- Regla intacta: teléfono y correo jamás en vistas públicas; `persons.phone`
  nace con la misma RLS que `players.phone` (0026/0027). Toda vista pública
  nueva se scopea por temporada/liga.

---

## 4. Plan por fases

Módulo por módulo (CLAUDE.md §2): cada fase se entrega funcionando, con
migraciones nuevas numeradas, tests donde hay cálculo/validación, y sin romper
la liga viva. El orden está elegido para que **tu urgencia (inscripciones
femenil) salga primero** y la cirugía mayor caiga cuando Reserve ya cerró.

| Fase | Qué entrega | Depende de | Ventana |
|---|---|---|---|
| **F0 — Rescate y decisiones** | JSON de la liga vieja rescatado (sección 7); decisión de formato femenil; fechas de inscripción | tú | esta semana |
| **F1 — Inscripciones femenil** | filas `leagues`+`seasons` nuevas (Liga Femenil, status inscripciones); `/registro` parametrizado por liga con categorías FEM (`season_categories`); landing mínima "próximamente + inscríbete"; opcional: pago con comprobante (patrón peak-padel, Storage privado) | nada del refactor grande | **días, no semanas** — no toca tablas de la liga viva |
| **F2 — Identidad `persons`** | tabla, backfill con cola de cotejo, `profiles.person_id`, claim v2 (persona ya con cuenta → login), compat con `player_id` hasta el corte | cierre de Team League 2026 (28-sep) | fin sep–oct |
| **F3 — Selector y rutas por liga** | landing selector, `/l/<slug>/...` + redirects, `useCompetition`, contenido con `league_id`, dashboard multi-liga | F2 (para "tus ligas") | oct |
| **F4 — Rating global** | eventos con `person_id`, recálculo multi-competencia ordenado por fecha, pesos por temporada, ficha de trayectoria; tests de invariantes | F2 | oct–nov |
| **F5 — Formato femenil** | (a) equipos: seeds/reglas, ~trivial; (b) parejas: módulo grupos/llaves completo | decisión #1 + F1 | según arranque femenil |
| **F6 — Importación liga vieja** | personas cotejadas + archivo de solo lectura de la edición pasada + efecto en rating (decisión #3) | F0 + F2 (+F4 si mueve rating) | cuando haya JSON |
| **F7 — peak-padel (opcional)** | absorber como `kind='tournament'` o dejarlo aparte | decisión #4 | fuera de alcance ahora |

Nota sobre F1/F2: las inscripciones abren ANTES del refactor de identidad a
propósito. Una inscripción es una fila en la bandeja (`player_registrations`),
no una ficha ni una cuenta; cuando el comité apruebe e integre el roster, F2 ya
estará puesta y las fichas nuevas nacerán enlazadas a personas. Si alguna
aprobación ocurre antes del corte, el cotejo de F2 la recoge — no hay carrera.

---

## 5. Qué le pasa a lo ya construido (inventario de cambios)

- `useActiveSeason` → `useCompetition(slug)` + query keys con season_id (el
  cambio toca ~28 páginas pero es mecánico gracias al cuello único).
- `handle_new_user` / `verify_player_claim` / `player_has_account` → versión
  persona (v2), manteniendo el camino viejo hasta el corte.
- `players_public`, vistas de standings/ranking: sin cambio de fondo (siguen
  por temporada); se añaden vistas de trayectoria por persona.
- Motor de rating: recálculo pasa de "temporada" a "todas las competencias en
  orden cronológico"; eventos ganan `person_id`; semilla se aplica a la persona.
- CSV import, draft, waitlist, swaps, alineaciones, resultados: **sin cambios**
  (ya son por temporada). El draft y la waitlist sirven tal cual para armar la
  femenil si es por equipos.
- CLAUDE.md y PRODUCT.md se actualizan al aterrizar F2/F3 (nueva §3.2-bis:
  persons; §3.3: claim v2; regla de oro nueva: "ninguna fusión de personas sin
  revisión humana").

## 6. Riesgos y cómo se contienen

1. **Liga viva hasta el 28-sep** → F1 no toca sus tablas; F2+ arranca tras la
   última jornada. Si hay reprogramaciones, F2 espera: nunca cirugía de
   identidad con jornada en curso.
2. **Fusión errónea de personas** (homónimas/erratas) → cotejo con revisión
   humana obligatoria para todo caso no exacto; auditoría de quién fusionó qué;
   operación "separar" disponible.
3. **Rating contaminado por historia importada** → la importación de la liga
   vieja NO genera eventos retroactivos por defecto; entra como trayectoria
   visible y, si acaso, como ajuste de semilla auditado (decisión #3).
4. **Cuentas viejas** → no se migran emails en auth; compat por doble columna
   hasta el corte; probar el flujo completo de login viejo en dev antes del
   deploy de F2.
5. **Un solo proyecto Supabase** → backups verificados + ensayo de F2 en
   branch/dev + migraciones numeradas nunca editadas (regla existente).

## 7. Lo que necesito de ti (bloqueantes de F0)

1. **Formato de la nueva liga femenil:** ¿por equipos (como Reserve) o por
   parejas con grupos (como la vieja / peak-padel)? Es LA decisión que
   dimensiona F5.
2. **Rescate de la app vieja** (desde tu máquina; este entorno tiene bloqueado
   ese dominio):
   ```bash
   curl -s https://diamondbacksleague.netlify.app/.netlify/functions/padel-get \
     -o liga_femenil_anterior.json
   ```
   y súbelo al repo (o compártemelo). Si además localizas la carpeta del código
   fuente (el deploy fue por CLI, sin repo), mejor: con eso reconstruyo su
   modelo exacto y las funciones de push/fotos por si algo vale la pena portar.
3. **¿La historia vieja mueve el rating global** o solo se muestra como
   trayectoria? (Mi recomendación: trayectoria + semilla dictada donde haga
   falta; sin eventos retroactivos.)
4. **peak-padel:** ¿entra a la unificación (sus 213 jugadoras se cotejan a
   persons) o se queda como app aparte por ahora?
5. **Fechas:** ¿cuándo quieres abrir inscripciones femenil y cuándo arranca su
   temporada? Con eso fijo F1 en el calendario y qué lleva (¿pago con
   comprobante desde el día 1?).

Con el #1 y el #5 respondidos, F1 (inscripciones femenil) se puede construir de
inmediato; nada de F1 queda hipotecado por las demás decisiones.
