# Plan maestro para desarrollo de app de liga de pádel por equipos

**Proyecto:** App para liga de pádel por equipos  
**Versión del documento:** 1.0  
**Objetivo:** Servir como especificación inicial para un agente de IA o equipo de desarrollo.  
**Plazo deseado:** 2–3 semanas para una primera versión funcional.  
**Stack recomendado para v1:** React + Vite + Tailwind CSS + Supabase + Netlify, como Web App / PWA mobile-first.

---

## 1. Resumen ejecutivo

Se requiere desarrollar una aplicación para administrar una liga de pádel por equipos. La liga tendrá 6 equipos de aproximadamente 25 jugadores cada uno, con categorías varoniles, femeniles y mixtas. La app debe permitir consultar públicamente rol de juegos, resultados, estadísticas, tabla de posiciones, equipos, rosters, noticias y reglamento. Además, debe ofrecer dashboards privados para jugadores, capitanes, organizadores y web manager.

La primera versión debe priorizar velocidad, estabilidad y facilidad de edición. Por ello, se recomienda crear una **Web App / PWA** con experiencia móvil, hospedada en Netlify y respaldada por Supabase. No se recomienda iniciar con apps nativas separadas para Android y iOS debido al plazo corto. La arquitectura debe dejar abierta la posibilidad de envolver la app posteriormente con Capacitor o migrar a Expo/React Native en una versión futura.

---

## 2. Stack tecnológico recomendado

### 2.1 Frontend

- **React** para construir interfaces mediante componentes reutilizables.
- **Vite** como herramienta de desarrollo y build rápido.
- **Tailwind CSS** para diseño mobile-first, moderno y estilizado tipo liga deportiva.
- **React Router** para rutas públicas y privadas.
- **TanStack Query** o alternativa similar para manejo de datos remotos, cache y estados de carga.
- **Zod** o validación equivalente para formularios e importaciones CSV.

### 2.2 Backend

- **Supabase Auth** para autenticación de usuarios.
- **Supabase Postgres** como base de datos.
- **Supabase Row Level Security** para permisos por rol.
- **Supabase Storage** para reglamento PDF, logos, banners e imágenes.
- **Supabase Edge Functions**, opcional para validaciones complejas, importación CSV, notificaciones y cálculos.

### 2.3 Hosting

- **Netlify** para desplegar la app web/PWA.
- Deploy automático desde repositorio Git.

### 2.4 Futuro nativo

- **Capacitor** como opción para envolver la PWA en apps móviles.
- **Expo/React Native** como alternativa futura si se decide rehacer o ampliar la app como aplicación nativa más completa.

---

## 3. Alcance de la primera versión

### 3.1 Objetivo de v1

Crear una app funcional que permita operar la liga desde el inicio de la temporada:

- Consultar rol de juegos.
- Consultar resultados.
- Consultar tabla de posiciones.
- Consultar estadísticas individuales y de equipo.
- Consultar equipos y rosters.
- Permitir login de jugadores, capitanes, organizadores y web manager.
- Permitir a capitanes enviar alineaciones.
- Validar alineaciones automáticamente.
- Permitir a capitanes reportar resultados.
- Permitir a organizadores validar resultados.
- Permitir a organizadores gestionar jugadores, equipos, calendario, resultados y reglamento.
- Permitir al web manager gestionar noticias, banners, reglamento y contenido público.

### 3.2 Fuera de alcance para v1

Dejar para v2:

- App Store / Play Store.
- Chat interno.
- Comentarios en noticias.
- Generador automático completo de calendario.
- Estadísticas avanzadas por pareja.
- Ranking predictivo.
- Pagos.
- Sistema complejo de sanciones.
- Fotos o videos pesados.

---

## 4. Modelo deportivo de la liga

### 4.1 Estructura general

- 6 equipos.
- 25 jugadores aproximados por equipo.
- 10 jornadas.
- Cada jornada juegan todos los equipos.
- Cada jornada tiene 3 enfrentamientos equipo vs equipo.
- Cada enfrentamiento tiene 9 partidos, uno por categoría.
- Cada jornada tiene 27 partidos.
- Se usan 9 canchas simultáneas.
- Se juegan 3 bloques de horario:
  - 18:30
  - 19:45
  - 21:00

Estructura:

```text
Temporada
→ Jornadas
→ Enfrentamientos equipo vs equipo
→ Partidos por categoría
→ Alineaciones
→ Resultados
→ Estadísticas
```

### 4.2 Categorías oficiales

| Código interno | Nombre visible | Tipo | Regla de elegibilidad |
|---|---|---|---|
| `VAR_4` | 4a Varonil | Varonil | 2 jugadores varoniles 4a |
| `VAR_5` | 5a Varonil | Varonil | 2 jugadores varoniles 5a |
| `VAR_6` | 6a Varonil | Varonil | 2 jugadores varoniles 6a |
| `FEM_4` | 4a Femenil | Femenil | 2 jugadoras femeniles 4a |
| `FEM_5` | 5a Femenil | Femenil | 2 jugadoras femeniles 5a |
| `FEM_6` | 6a Femenil | Femenil | 2 jugadoras femeniles 6a |
| `FEM_7` | 7a Femenil | Femenil | 2 jugadoras femeniles 7a |
| `MIX_A` | Mixta A | Mixta | 1 varonil 5a + 1 femenil 4a |
| `MIX_B` | Mixta B | Mixta | 1 varonil 6a + 1 femenil 5a |

### 4.3 Partidos por jornada

Cada enfrentamiento equipo vs equipo incluye los siguientes 9 partidos:

1. 4a Varonil
2. 5a Varonil
3. 6a Varonil
4. 4a Femenil
5. 5a Femenil
6. 6a Femenil
7. 7a Femenil
8. Mixta A
9. Mixta B

Como hay 3 enfrentamientos por jornada:

```text
9 categorías × 3 enfrentamientos = 27 partidos por jornada
```

---

## 5. Sistema de puntos y resultados

### 5.1 Formato de partido

- Todos los partidos se juegan a 3 sets.
- El tercer set es set completo.
- Se juega con punto de oro.

### 5.2 Puntuación por partido

| Resultado | Puntos para ganador | Puntos para perdedor |
|---|---:|---:|
| Victoria en 2 sets | 3 | 0 |
| Victoria en 3 sets | 3 | 1 |
| Default / walkover | 3 | 0 |

### 5.3 Default / walkover

Si una pareja no se presenta:

- El rival gana 6-0, 6-0.
- El rival suma 3 puntos.
- El equipo ausente suma 0 puntos.
- Los jugadores alineados del rival reciben victoria y 3 puntos aportados.
- Los jugadores alineados ausentes reciben derrota y 0 puntos aportados.

### 5.4 Captura de resultados

- Los capitanes reportan resultados.
- Los organizadores validan resultados.
- Los organizadores también pueden capturar resultados directamente.
- Un resultado reportado por capitán queda como pendiente hasta validación del organizador.

Estados sugeridos de resultado:

```text
pending_report
reported
validated
disputed
walkover
corrected
```

---

## 6. Tabla de posiciones de equipos

### 6.1 Criterios de orden

1. Puntos totales.
2. Partidos ganados.
3. Diferencia de sets.
4. Diferencia de juegos.
5. Enfrentamiento directo.
6. Decisión de organizador.

### 6.2 Estadísticas de equipo

Cada equipo debe mostrar:

- Partidos jugados.
- Partidos ganados.
- Partidos perdidos.
- Puntos totales.
- Puntos por jornada.
- Sets ganados.
- Sets perdidos.
- Diferencia de sets.
- Juegos ganados.
- Juegos perdidos.
- Diferencia de juegos.
- Rendimiento por categoría.
- Resultados recientes.
- Próximo enfrentamiento.

---

## 7. Ranking individual

### 7.1 Criterios de orden

El ranking individual se ordena desde el primer partido jugado, sin mínimo de partidos. El criterio principal será la contribución acumulada, para evitar que jugadores con un solo partido ganado y 100% de victorias acaparen los primeros lugares.

Orden definitivo:

1. Puntos aportados.
2. Porcentaje de victorias.
3. Partidos ganados.
4. Diferencia de sets.
5. Diferencia de juegos.
6. Menor cantidad de derrotas.
7. Orden alfabético.

Pseudo-orden SQL:

```sql
ORDER BY
  points_contributed DESC,
  win_percentage DESC,
  matches_won DESC,
  set_difference DESC,
  game_difference DESC,
  matches_lost ASC,
  player_name ASC;
```

### 7.2 Puntos individuales

Cada jugador recibe los mismos puntos que ganó su pareja en el partido:

| Resultado de pareja | Puntos para cada jugador |
|---|---:|
| Gana en 2 sets | 3 |
| Gana en 3 sets | 3 |
| Pierde en 3 sets | 1 |
| Pierde en 2 sets | 0 |
| Gana por default | 3 |
| Pierde por default | 0 |

### 7.3 Estadísticas individuales

Cada jugador debe mostrar:

- Partidos jugados.
- Partidos ganados.
- Partidos perdidos.
- Porcentaje de victoria.
- Puntos aportados.
- Sets ganados.
- Sets perdidos.
- Diferencia de sets.
- Juegos ganados.
- Juegos perdidos.
- Diferencia de juegos.
- Ranking general.
- Ranking por categoría.
- Historial de partidos.
- Próximo partido, si está alineado.

---

## 8. Alineaciones

### 8.1 Flujo de alineación

1. El organizador publica el rol de la temporada.
2. Cada capitán ve su próximo enfrentamiento.
3. El capitán envía la alineación exacta por categoría.
4. La app valida automáticamente que la alineación sea legal.
5. El capitán puede modificar hasta 1 hora antes del partido.
6. Cada equipo tiene máximo 5 cambios por temporada.
7. Cada cambio cuenta por partido modificado, no por jugador individual.
8. Después del límite, solo el organizador puede hacer cambios.

### 8.2 Reglas de alineación

La app debe impedir:

- Que un jugador juegue fuera de su categoría.
- Que una jugadora juegue en una categoría varonil.
- Que un jugador varonil juegue en una categoría femenil.
- Que un jugador aparezca más de una vez en la misma jornada.
- Que un jugador de otro equipo sea alineado.
- Que una categoría quede incompleta.
- Que las mixtas se armen con jugadores incorrectos.

### 8.3 Validaciones específicas

Para cada categoría:

- `VAR_4`: 2 jugadores varoniles 4a.
- `VAR_5`: 2 jugadores varoniles 5a.
- `VAR_6`: 2 jugadores varoniles 6a.
- `FEM_4`: 2 jugadoras femeniles 4a.
- `FEM_5`: 2 jugadoras femeniles 5a.
- `FEM_6`: 2 jugadoras femeniles 6a.
- `FEM_7`: 2 jugadoras femeniles 7a.
- `MIX_A`: 1 varonil 5a + 1 femenil 4a.
- `MIX_B`: 1 varonil 6a + 1 femenil 5a.

### 8.4 Mensajes de error sugeridos

Ejemplos:

```text
Error en Mixta A: María López ya está alineada en 4a Femenil para esta jornada. No puede jugar dos partidos en la misma jornada.
```

```text
Error en Mixta B: el jugador seleccionado debe ser varonil 6a.
```

```text
Error en 5a Varonil: falta seleccionar un segundo jugador.
```

---

## 9. Cambios de alineación

### 9.1 Regla confirmada

- Máximo 5 cambios por equipo por temporada.
- Un cambio cuenta por partido modificado.
- Los cambios son permitidos hasta 1 hora antes del partido.
- Después del límite, solo organizador puede modificar.

### 9.2 Ejemplos

- Cambiar una pareja completa de 5a Femenil cuenta como 1 cambio.
- Cambiar Mixta A cuenta como 1 cambio.
- Modificar tres categorías cuenta como 3 cambios.

### 9.3 Estados de alineación

Estados sugeridos:

```text
draft
submitted
modified
locked
validated
admin_edited
```

---

## 10. Rol de juegos

### 10.1 Enfoque elegido para v1

La app no generará automáticamente el rol en la primera versión. El rol completo de 10 jornadas se preparará en Excel o Google Sheets y se importará mediante CSV.

Flujo:

```text
1. El organizador prepara rol completo de temporada.
2. Exporta CSV.
3. La app importa CSV.
4. La app valida estructura y errores.
5. La app guarda como borrador.
6. El organizador publica.
7. Jugadores y público consultan el rol.
```

### 10.2 Reparto de horarios

Cada categoría juega 3 veces por jornada, una por cada enfrentamiento.

En 10 jornadas, cada categoría tiene 30 partidos. Como hay 3 horarios, el reparto ideal por categoría es:

- 10 partidos a las 18:30.
- 10 partidos a las 19:45.
- 10 partidos a las 21:00.

### 10.3 Validaciones al importar rol

La app debe revisar:

- 270 partidos totales.
- 10 jornadas.
- 27 partidos por jornada.
- 3 enfrentamientos por jornada.
- 9 partidos por enfrentamiento.
- 1 partido por categoría en cada enfrentamiento.
- 9 partidos por horario en cada jornada.
- 9 canchas por horario.
- Ningún choque de cancha y horario.
- Equipos existentes.
- Categorías existentes.
- Balance de categorías por horario.
- Cada equipo juega 9 partidos por jornada.

### 10.4 Errores bloqueantes

No se debe permitir publicar si existe:

- Cancha repetida en mismo horario.
- Categoría inválida.
- Equipo inexistente.
- Jornada con menos o más de 27 partidos.
- Enfrentamiento sin sus 9 categorías.
- Partido duplicado.

### 10.5 Advertencias no bloqueantes

Puede permitir publicar con advertencia si:

- Una categoría tiene 11 partidos en un horario y 9 en otro.
- Un equipo queda muy cargado en un horario.
- Una cancha se usa más que otras a lo largo de la temporada.

---

## 11. CSV recomendados

### 11.1 CSV de equipos

```csv
team_name,color,logo_url,captain_email
Equipo Rojo,#D72638,,capitanrojo@email.com
Equipo Azul,#1B4DFF,,capitanazul@email.com
```

### 11.2 CSV de jugadores

```csv
full_name,email,phone,team_name,gender,category_code,is_captain
Juan Pérez,juan@email.com,6140000000,Equipo Rojo,male,VAR_5,false
Ana López,ana@email.com,6140000001,Equipo Rojo,female,FEM_4,false
Carlos Ruiz,carlos@email.com,6140000002,Equipo Rojo,male,VAR_5,true
```

Validaciones:

- Email único.
- Teléfono único, si se usa como control administrativo.
- Equipo existente.
- Categoría existente.
- Género consistente con categoría.
- Máximo 25 jugadores por equipo.
- Al menos un capitán por equipo.
- Un jugador no puede pertenecer a dos equipos.

### 11.3 CSV de rol

```csv
season_name,round_number,round_date,time_block,court_number,team_a,team_b,category_code
Liga 2026,1,2026-07-06,18:30,1,Equipo Rojo,Equipo Azul,VAR_4
Liga 2026,1,2026-07-06,18:30,2,Equipo Verde,Equipo Negro,MIX_A
Liga 2026,1,2026-07-06,18:30,3,Equipo Blanco,Equipo Dorado,FEM_6
```

---

## 12. Roles y permisos

### 12.1 Visitante público

Puede ver sin login:

- Inicio.
- Noticias.
- Rol de juegos.
- Resultados.
- Tabla de posiciones.
- Equipos.
- Rosters.
- Estadísticas individuales deportivas.
- Estadísticas de equipo.
- Reglamento PDF.

No puede ver:

- Dashboard individual.
- Teléfonos.
- Correos.
- Herramientas de capitán.
- Panel organizador.
- Panel web manager.

### 12.2 Jugador

Puede ver:

- Dashboard personal.
- Su próximo partido.
- Su equipo.
- Sus estadísticas.
- Su historial.
- Noticias.
- Reglamento.
- Información pública general.

No puede:

- Enviar alineaciones.
- Reportar resultados.
- Validar resultados.
- Editar jugadores, equipos o rol.

### 12.3 Capitán

Puede:

- Ver dashboard de capitán.
- Ver teléfonos de sus propios jugadores.
- Enviar alineaciones de su equipo.
- Modificar alineaciones dentro del límite.
- Reportar resultados.
- Ver resultados pendientes.
- Ver estado de validación.

No puede:

- Validar resultados oficialmente.
- Ver teléfonos de otros equipos.
- Editar resultados oficiales ya validados.
- Editar equipos o jugadores fuera de su equipo.

### 12.4 Organizador

Puede:

- Gestionar equipos.
- Gestionar jugadores.
- Gestionar capitanes.
- Importar CSV.
- Gestionar rol.
- Ver y editar alineaciones si es necesario.
- Validar resultados.
- Capturar resultados directamente.
- Corregir resultados.
- Subir reglamento PDF.
- Publicar noticias.
- Enviar avisos.
- Ver teléfonos y correos.

### 12.5 Web manager

Puede:

- Publicar noticias.
- Editar noticias.
- Subir banners.
- Actualizar contenido visual.
- Subir o reemplazar reglamento PDF.
- Crear avisos informativos.

No puede, salvo que también sea organizador:

- Editar resultados.
- Editar alineaciones.
- Editar jugadores.
- Editar equipos.
- Cambiar puntos o estadísticas oficiales.

---

## 13. Privacidad de datos

### 13.1 Datos públicos

- Nombre del jugador.
- Equipo.
- Categoría.
- Estadísticas deportivas.
- Resultados.
- Ranking.
- Roster.

### 13.2 Datos privados

- Teléfono.
- Correo.

### 13.3 Acceso a datos privados

- El jugador puede ver sus propios datos.
- El capitán puede ver teléfono de sus propios jugadores.
- El organizador puede ver teléfono y correo de todos.
- El público no ve teléfono ni correo.
- El web manager no ve teléfono ni correo salvo permiso adicional.

---

## 14. Autenticación

Todos los jugadores tendrán cuenta.

### 14.1 Recomendación inicial

Usar email + contraseña, con contraseña temporal inicial y recuperación por correo.

Opción sugerida:

- El organizador carga jugadores por CSV.
- Cada jugador recibe o conoce una contraseña inicial.
- Capitanes y organizadores deben cambiar contraseña al primer login.
- Se permite recuperación de contraseña por email.

### 14.2 Magic Link

Magic Link puede dejarse como alternativa futura. Permite login sin contraseña mediante enlace enviado por correo, pero puede generar problemas si el correo cae en spam o si el usuario no encuentra el enlace en momentos críticos.

---

## 15. Pantallas principales

### 15.1 Públicas

- Home pública.
- Noticias.
- Rol de juegos.
- Resultados.
- Tabla de posiciones.
- Estadísticas individuales.
- Estadísticas de equipo.
- Equipos y rosters.
- Reglamento PDF.
- Login.

### 15.2 Jugador

- Dashboard personal.
- Mi próximo partido.
- Mi equipo.
- Mis estadísticas.
- Mi historial.
- Mis avisos.
- Mi perfil.

### 15.3 Capitán

- Dashboard de capitán.
- Próximo enfrentamiento.
- Estado de alineación.
- Enviar alineación.
- Cambios usados 0/5.
- Reportar resultados.
- Resultados pendientes.
- Teléfonos de su equipo.

### 15.4 Organizador

- Dashboard organizador.
- Gestión de equipos.
- Gestión de jugadores.
- Importación CSV.
- Gestión de jornadas.
- Gestión de rol.
- Estado de alineaciones.
- Validación de resultados.
- Captura directa de resultados.
- Noticias.
- Reglamento PDF.
- Avisos.

### 15.5 Web manager

- Noticias.
- Banners.
- Reglamento.
- Contenido público.
- Avisos informativos.

---

## 16. Notificaciones y avisos

### 16.1 Requerimientos

Se desea:

- Push notifications.
- Avisos internos dentro de la app.
- Posibilidad de compartir por WhatsApp ciertos avisos.

### 16.2 Recomendación para v1

Prioridad:

1. Avisos internos dentro de la app.
2. Botón para compartir aviso por WhatsApp.
3. Push notifications si el tiempo lo permite.

### 16.3 Tipos de aviso

- Nueva noticia.
- Cambio de horario/cancha.
- Alineación pendiente.
- Resultado pendiente de reportar.
- Resultado validado.
- Reglamento actualizado.
- Comunicado general.
- Aviso para capitanes.
- Aviso para un equipo específico.

---

## 17. Base de datos sugerida

### 17.1 `profiles`

```text
id
user_id
full_name
email
phone
role
team_id
is_active
created_at
updated_at
```

### 17.2 `teams`

```text
id
season_id
name
color
logo_url
captain_profile_id
slogan
created_at
updated_at
```

### 17.3 `players`

```text
id
profile_id
team_id
full_name
gender
category_code
is_active
is_captain
created_at
updated_at
```

### 17.4 `seasons`

```text
id
name
start_date
end_date
status
created_at
updated_at
```

### 17.5 `rounds`

```text
id
season_id
round_number
name
round_date
status
created_at
updated_at
```

### 17.6 `team_matchups`

```text
id
round_id
team_a_id
team_b_id
status
created_at
updated_at
```

### 17.7 `match_categories`

```text
id
code
name
type
sort_order
is_active
```

### 17.8 `category_eligibility_rules`

```text
id
match_category_code
required_gender
required_player_category_code
required_count
```

### 17.9 `time_blocks`

```text
id
label
start_time
sort_order
```

Valores iniciales:

```text
18:30
19:45
21:00
```

### 17.10 `courts`

```text
id
name
number
is_active
```

Valores iniciales:

```text
Cancha 1
Cancha 2
...
Cancha 9
```

### 17.11 `schedule_slots`

```text
id
round_id
time_block_id
court_id
is_available
```

### 17.12 `matches`

```text
id
round_id
team_matchup_id
category_code
schedule_slot_id
status
created_at
updated_at
```

### 17.13 `lineups`

```text
id
team_matchup_id
team_id
submitted_by
status
submitted_at
locked_at
change_count_used
created_at
updated_at
```

### 17.14 `lineup_entries`

```text
id
lineup_id
match_id
category_code
player_1_id
player_2_id
created_at
updated_at
```

### 17.15 `lineup_change_logs`

```text
id
lineup_id
team_id
round_id
match_id
changed_by
change_number
before_data
after_data
reason
created_at
```

### 17.16 `match_results`

```text
id
match_id
reported_by
validated_by
status
set1_team_a
set1_team_b
set2_team_a
set2_team_b
set3_team_a
set3_team_b
winner_team_id
loser_team_id
winner_points
loser_points
is_walkover
walkover_team_id
notes
created_at
validated_at
updated_at
```

### 17.17 `news_posts`

```text
id
title
body
image_url
audience
target_team_id
published
published_at
created_by
created_at
updated_at
```

### 17.18 `league_documents`

```text
id
title
file_url
document_type
version
is_active
uploaded_by
created_at
```

### 17.19 `notifications`

```text
id
title
body
target_role
target_team_id
target_user_id
channel
status
created_by
created_at
sent_at
```

---

## 18. Seguridad y Row Level Security

La seguridad debe estar implementada en la base de datos, no solo en la interfaz.

Reglas generales:

- Público puede leer datos deportivos públicos.
- Público no puede leer teléfonos ni correos.
- Jugador puede leer su propio perfil privado.
- Capitán puede leer teléfonos de jugadores de su equipo.
- Organizador puede leer y editar datos administrativos.
- Web manager puede editar contenido público, no resultados deportivos.
- Solo capitanes pueden enviar alineaciones de su equipo.
- Solo capitanes pueden reportar resultados de partidos de su equipo.
- Solo organizadores pueden validar resultados.
- Solo organizadores pueden modificar resultados validados.

---

## 19. Diseño visual

### 19.1 Estilo deseado

App mobile-first con estética deportiva premium.

Elementos:

- Colores por equipo.
- Tarjetas de partido.
- Badges de categoría.
- Marcadores grandes.
- Navegación inferior móvil.
- Dashboard con métricas claras.
- Tablas responsivas.
- Estilo limpio para uso en cancha.

### 19.2 Navegación móvil sugerida

Pública:

```text
Inicio | Rol | Resultados | Tabla | Más
```

Jugador:

```text
Inicio | Mi partido | Mi equipo | Stats | Más
```

Capitán:

```text
Inicio | Alineación | Resultados | Equipo | Más
```

Organizador:

```text
Dashboard | Rol | Alineaciones | Resultados | Admin
```

---

## 20. Plan de trabajo por semanas

### Semana 1: estructura, datos y acceso

Objetivos:

- Crear proyecto React + Vite + Tailwind.
- Configurar Supabase.
- Crear esquema inicial de base de datos.
- Configurar Auth.
- Implementar roles.
- Crear vistas públicas básicas.
- Crear importación de equipos y jugadores.
- Crear importación de rol CSV.
- Crear validaciones de CSV.
- Crear pantallas de equipos y rosters.
- Crear pantalla de reglamento PDF.
- Deploy inicial en Netlify.

Entregable:

- App navegable.
- Login funcionando.
- Datos cargados.
- Rol visible públicamente.

### Semana 2: alineaciones y validaciones deportivas

Objetivos:

- Panel de capitán.
- Enviar alineación por categoría.
- Validar elegibilidad.
- Validar mixtas.
- Validar no repetición de jugador en jornada.
- Validar límite de 5 cambios por equipo por temporada.
- Bloquear cambios 1 hora antes del partido.
- Panel organizador para ver estado de alineaciones.
- Edición administrativa de alineaciones.

Entregable:

- Capitanes pueden enviar alineaciones legales.
- Organizadores pueden monitorear estado de alineaciones.

### Semana 3: resultados, estadísticas y pulido

Objetivos:

- Reporte de resultados por capitán.
- Validación por organizador.
- Captura directa por organizador.
- Walkover 6-0, 6-0.
- Cálculo automático de puntos.
- Tabla de posiciones.
- Ranking individual.
- Estadísticas por equipo.
- Noticias.
- Avisos internos.
- Botón compartir por WhatsApp.
- Push notifications si alcanza.
- Pulido visual móvil.
- Pruebas con datos reales o simulados.

Entregable:

- App lista para operar una jornada real.

---

## 21. Prioridades

### Imprescindible para v1

1. Login.
2. Roles.
3. Equipos.
4. Jugadores.
5. Importador CSV de rol.
6. Rol público.
7. Alineaciones.
8. Validaciones.
9. Resultados.
10. Tabla de posiciones.
11. Ranking individual.
12. Estadísticas básicas.
13. Noticias.
14. Reglamento PDF.
15. Panel organizador.

### Deseable si alcanza

1. Push notifications.
2. Compartir por WhatsApp.
3. Dashboard visual premium.
4. Carga masiva más robusta.
5. Exportar resultados.
6. Histórico detallado por pareja.

### V2

1. App nativa con Capacitor o Expo.
2. Generador automático de calendario equilibrado.
3. Chat interno.
4. Comentarios en noticias.
5. Sistema avanzado de sanciones.
6. Estadísticas avanzadas por pareja y rival.
7. Rankings especiales.

---

## 22. Pendientes menores por definir

Estos puntos no bloquean el inicio del proyecto, pero deben definirse antes de lanzar públicamente:

1. Nombre oficial de la liga.
2. Logo oficial.
3. Colores oficiales de la liga.
4. Nombre, logo y color de cada equipo.
5. Fechas exactas de las 10 jornadas.
6. Nombres finales de las canchas.
7. Reglamento PDF final.
8. Textos de bienvenida.
9. Dominio o subdominio de la app.
10. Contraseña inicial o flujo final de activación de usuarios.
11. Decidir proveedor o estrategia final de push notifications.
12. Definir si el email del capitán será visible para sus jugadores o solo teléfono.

---

## 23. Instrucciones para agente de IA de desarrollo

El agente debe trabajar por módulos, no intentar construir toda la app en una sola respuesta.

Orden recomendado:

1. Crear proyecto base con React + Vite + Tailwind.
2. Configurar Supabase client.
3. Crear esquema SQL inicial.
4. Crear seeds de categorías, horarios y canchas.
5. Configurar Auth y roles.
6. Crear layout público y privado.
7. Crear páginas públicas.
8. Crear importadores CSV.
9. Crear validadores de rol.
10. Crear panel de capitán.
11. Crear validación de alineaciones.
12. Crear panel organizador.
13. Crear reporte y validación de resultados.
14. Crear cálculo de estadísticas.
15. Crear noticias y reglamento PDF.
16. Crear avisos internos.
17. Pulir diseño móvil.
18. Probar con datos simulados.
19. Preparar deploy a Netlify.

Regla de trabajo:

> Cada módulo debe entregarse funcionando, con rutas, componentes, consultas Supabase, validaciones y manejo de errores. No avanzar al siguiente módulo si el anterior rompe navegación, autenticación o permisos.

---

## 24. Prompt inicial sugerido para el agente

```text
Actúa como arquitecto senior y desarrollador full-stack. Vamos a construir una Web App/PWA mobile-first para una liga de pádel por equipos usando React + Vite + Tailwind CSS en frontend, Supabase Auth/Postgres/Storage/RLS en backend y Netlify para hosting.

Lee el documento de especificación completo antes de proponer código. Primero genera una arquitectura de carpetas, modelo de datos SQL para Supabase, políticas RLS iniciales y plan de implementación por módulos. No construyas toda la app de una vez. Trabaja incrementalmente.

Prioriza que la app esté usable en 2–3 semanas. La app debe tener área pública, login para todos los jugadores, roles de jugador/capitán/organizador/web manager, importación CSV de equipos/jugadores/rol, validación de alineaciones, reporte y validación de resultados, tabla de posiciones, estadísticas y reglamento PDF.

Antes de escribir código, confirma supuestos técnicos y después entrega el primer módulo: estructura del proyecto, dependencias, rutas base y conexión a Supabase.
```

---

## 25. Resumen final

La primera versión debe enfocarse en operar la liga de forma confiable. La prioridad no es tener una app nativa en tiendas, sino una PWA móvil sólida, pública, rápida de actualizar y con backend seguro. El corazón de la app será el sistema de alineaciones con validación automática y el cálculo correcto de resultados, puntos y estadísticas.

La ruta recomendada es:

```text
V1: React + Vite + Tailwind + Supabase + Netlify + CSV
V2: Push más robusto, generador automático de calendario, Capacitor/Expo si se requiere app nativa
```
