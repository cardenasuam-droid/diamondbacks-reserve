# CLAUDE.md — Liga de pádel por equipos

Guía para el agente. Léela completa antes de escribir código. La especificación
funcional vive en `plan_app_liga_padel_equipos.md`; este archivo manda sobre
decisiones técnicas y de proceso.

---

## 1. Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS. Mobile-first / PWA.
- **Datos remotos:** TanStack Query. Validación con Zod (formularios e import CSV).
- **Backend:** Supabase (Postgres + Auth + Storage + RLS).
- **Hosting:** Netlify, deploy automático desde Git.
- **PWA:** `vite-plugin-pwa` para lectura offline del rol y la alineación en cancha.
- **Tests:** Vitest. Obligatorios para la lógica de validación de alineaciones y
  para el cálculo de puntos/tabla/ranking. Son el corazón de la app.

## 2. Proceso de trabajo (regla dura)

> Trabaja **módulo por módulo** en el orden de la sección 23 del plan. NO intentes
> construir toda la app en una respuesta. No avances al siguiente módulo si el
> anterior rompe navegación, autenticación o permisos. Cada módulo se entrega con
> rutas, componentes, queries de Supabase, validación y manejo de errores.

Orden: proyecto base → cliente Supabase → esquema SQL → seeds → Auth y roles →
layout público/privado → páginas públicas → importadores CSV → validadores de rol
→ panel capitán → validación de alineaciones → panel organizador → resultados →
estadísticas → noticias/reglamento → avisos → pulido móvil → pruebas → deploy.

## 3. Decisiones de arquitectura ya tomadas (no las reabras sin preguntar)

### 3.1 Backend: nube + migraciones, sin Docker
Se usa un proyecto Supabase en la nube enlazado con la CLI (`supabase link`). Todo
el esquema vive como migraciones versionadas en `supabase/migrations/`. Cambios con
`supabase db push`. Mientras no haya usuarios reales, ese proyecto es "dev"; en el
lanzamiento se clona a un proyecto "prod". No se usa entorno local con Docker.

### 3.2 `players` vs `profiles` (resuelve la doble fuente de verdad)
- **`players`** = ficha de roster. Es la fuente de verdad deportiva. Siempre existe
  (entra por CSV). Rosters, resultados, alineaciones y rankings dependen de aquí, NO
  de que el jugador inicie sesión alguna vez.
- **`profiles`** = la cuenta (`id` = `auth.users.id`). Se crea en el primer login y
  se enlaza a un `player` por email mediante un trigger. Solo sirve para el dashboard
  personalizado y para `role`/permisos.
- El **rol** vive en `profiles.role`. El **capitán** vive solo en `players.is_captain`
  (índice único parcial: máximo un capitán por equipo). No dupliques capitán en `teams`.

### 3.3 Login: elegir nombre + contraseña (verificación por teléfono)
> Cambiado (2026-06-22) desde el OTP por email original, por simplicidad. NO
> requiere SMTP. Guía: `docs/auth-smtp-setup.md`.

El jugador **elige su nombre** de la lista del roster y, la primera vez, confirma
su identidad con los **últimos 4 dígitos de su teléfono** y crea una contraseña;
después entra con nombre + contraseña desde cualquier dispositivo. La sesión de
Supabase persiste hasta cerrar sesión.

Por debajo es email+password de Supabase, pero el email es **sintético** y se
deriva del `player_id` público (`<player_id>@players.local`): el jugador nunca ve
ni escribe un email. La verificación del teléfono se hace en el **servidor**
(trigger `handle_new_user` + RPC `verify_player_claim`, migración 0008); el
teléfono nunca se expone al cliente. Un índice único `profiles.player_id` impide
reclamar la misma ficha dos veces.

**Todos los roles usan el mismo mecanismo** (elegir nombre + contraseña). El
**staff** (organizador/web manager) que no está en el roster vive en la tabla
semilla `staff_members` (full_name, role, `access_code`); aparece en el mismo
selector y su verificación de primer acceso es el **código** (no tiene teléfono).
Esto resuelve el arranque: alguien sube los jugadores reales antes de que existan
jugadores. Email sintético `<staff_id>@staff.local`; migración 0009. Bootstrap:
insertar la primera fila de `staff_members` a mano (SQL) para arrancar; la lista
completa se carga después. Queda además un **login por correo** oculto como
respaldo de emergencia (cuenta creada en el panel de Supabase). Requiere en
Supabase: Email provider ON y **Confirm email OFF**.

### 3.4 Puntos, tabla y ranking se DERIVAN, no se almacenan
`match_results` guarda solo marcadores por set + ganador + flag de walkover. Los
puntos (3/1/0), sets y juegos se calculan en **vistas SQL** (`team_standings`,
`player_rankings`). Una sola fuente de verdad para público y dashboards. No
almacenes puntos en columnas: evita inconsistencias.

### 3.5 Validaciones críticas en el servidor, no solo en la UI
El bloqueo "1 hora antes" y el límite de "5 cambios por equipo por temporada" se
hacen cumplir con **triggers** (ya incluidos), además de la UI. Si solo están en
React, se saltan trivialmente.

## 4. Reglas deportivas (referencia rápida)

- **Puntos por partido:** gana en 2 sets → 3/0; gana en 3 sets → 3/1; walkover → 3/0.
- **Puntos de equipo:** suma de los puntos de sus 9 partidos de categoría por jornada.
- **Walkover:** el rival gana 6-0, 6-0. Jugadores alineados ausentes: derrota y 0.
- **Puntos individuales:** cada jugador recibe los puntos que ganó su pareja.
- **Orden tabla de equipos:** 1) puntos, 2) partidos ganados, 3) dif. sets,
  4) dif. juegos, 5) duelo directo, 6) decisión organizador.
  - El **duelo directo** es pairwise (puntos entre los dos equipos empatados) y se
    resuelve en lógica de app usando la vista `head_to_head`, NO en el `ORDER BY`
    global. La decisión del organizador es el último recurso, manual.
- **Orden ranking individual:** 1) puntos aportados, 2) % victorias, 3) partidos
  ganados, 4) dif. sets, 5) dif. juegos, 6) menos derrotas, 7) alfabético.
- **Categorías (9):** VAR_4/5/6, FEM_4/5/6/7, MIX_A (VAR_5 + FEM_4), MIX_B (VAR_6 + FEM_5).
- La elegibilidad por categoría está data-driven en `category_eligibility_rules`;
  la validación de alineación lee esa tabla, no la hardcodees.

## 5. Convenciones de código

- **Identificadores en inglés** (tablas, columnas, componentes, variables). Textos
  de UI en español.
- **Carpetas:** organización por dominio en `src/features/` (lineups, results,
  standings, roster, news, schedule…). UI compartida en `src/components/ui/`.
  Cliente Supabase en `src/lib/supabase.ts`. Rutas separadas por audiencia en
  `src/routes/` (public / player / captain / organizer).
- **SQL:** una migración por cambio lógico, numeradas y nunca editadas
  retroactivamente (crea una nueva). El seed de datos fijos va en `supabase/seed.sql`.
- Nunca expongas teléfono ni correo en consultas públicas. La privacidad se hace
  cumplir en RLS, no solo ocultando columnas en la UI.

## 6. Estructura de carpetas objetivo

```
/
├─ CLAUDE.md
├─ plan_app_liga_padel_equipos.md
├─ supabase/
│  ├─ migrations/      # esquema versionado (ya iniciado)
│  ├─ seed.sql         # categorías, reglas de elegibilidad, horarios, canchas
│  └─ functions/       # Edge Functions: import CSV, etc. (cuando aplique)
├─ src/
│  ├─ lib/supabase.ts
│  ├─ features/
│  ├─ components/ui/
│  ├─ routes/
│  └─ hooks/
└─ tests/
```

## 7. Arranque del backend (una sola vez)

```bash
# 1. Crea un proyecto gratis en https://supabase.com y copia su ref y password.
npm i -g supabase            # CLI
supabase login
supabase link --project-ref <TU_REF>

# 2. Aplica el esquema (migraciones en orden) y los datos fijos.
supabase db push             # corre supabase/migrations/*.sql
psql "<CONNECTION_STRING>" -f supabase/seed.sql   # o desde el SQL Editor

# 3. En Supabase Studio > Authentication: activa Email OTP y configura SMTP
#    propio (p. ej. Resend) para que lleguen los códigos.
```

Variables de entorno del frontend (`.env`, NUNCA commitearlas):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
La `service_role` key solo se usa en Edge Functions del servidor, jamás en el cliente.
