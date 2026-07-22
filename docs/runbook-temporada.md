# Runbook de temporada

Qué hacer cuando algo va mal durante la liga. Escrito para leerse **en el
momento**, no antes.

Regla de oro: **casi todo es reversible re-guardando**. Lo único que no se
deshace solo es borrar jugadores o equipos.

---

## Calendario semanal

| Cuándo | Qué |
|---|---|
| Sábado 07:00 | Se cierran las alineaciones. Después solo las edita el organizador. |
| Sábado (mañana) | Cerrar y publicar la jornada desde **Estado de alineaciones**. |
| Lunes | Se juega. |
| Lunes noche / martes | Capturar resultados y correr `npm run check:standings`. |

---

## Capturar resultados

**Quién.** Las capitanas reportan (**Capturar resultados** en su menú) y el
organizador valida. El organizador también puede capturar directo.

**Un reporte de capitana no mueve nada** hasta que se valida: la tabla, el
ranking y el rating solo cuentan resultados `validated`, `walkover` o
`corrected`. Mientras esté "Por validar", es corregible por cualquiera de las
dos capitanas.

**Validar** = abrir el partido en *Organización → Resultados* (se pre-llena con
lo reportado) y **Guardar**. Ahí es cuando mueve tabla y rating.

**Los walkovers y los retiros los captura solo el organizador.** Las capitanas
tienen la validación estricta de pádel; el organizador puede meter marcadores
atípicos (un 3-1 por retiro, por ejemplo).

### Si algo sale mal

| Síntoma | Qué hacer |
|---|---|
| Marcador equivocado | Reabrir el partido, corregir, Guardar. Recalcula todo solo. |
| Resultado en el partido equivocado | Reabrirlo → **Borrar resultado** → capturarlo en el correcto. |
| "El resultado se guardó, pero el rating no se pudo recalcular" | El marcador **está a salvo**. Ve a *Organización → Rating* y pulsa **Recalcular**. |
| Reabres un walkover y no sabes quién faltó | Ya viene pre-llenado. Si dudas, el rol público muestra el ganador. |

**Captura desde un solo dispositivo.** Dos personas guardando a la vez pueden
pisarse el recálculo del rating (hay un seguro en la base desde la migración
0044, pero el orden de captura sigue siendo más fácil de seguir con un solo
punto de entrada).

---

## Verificar que las cuentas cuadran

Después de cada jornada:

```bash
npm run check:standings
```

Recalcula puntos, tabla y ranking **por su cuenta**, desde el reglamento, y los
compara con lo que muestra la app. Termina en uno de dos sitios:

- `✅ TODO CUADRA` — nada que hacer.
- `❌ N discrepancia(s)` — **no lo ignores**: hay un partido mal capturado o un
  fallo de cálculo. El listado dice cuál y en qué campo.

También avisa de partidos con resultado pero **sin alineación completa**: esos no
suman a ningún jugador aunque sí cuenten para el equipo.

---

## Alineaciones

**El cupo son 5 cambios por equipo y temporada**, y solo cuentan los cambios
hechos **después de publicar el rol**. Todo lo anterior —borradores, reenvíos,
correcciones del armado— es libre.

| Situación | Qué hacer |
|---|---|
| Una capitana no llegó al sábado 07:00 | El organizador edita por ella: *Estado de alineaciones → Editar*. |
| Hay que cambiar un rol ya publicado | Igual, desde *Editar*. Consume uno de los 5 del equipo y queda registrado. |
| "Límite alcanzado: el equipo ya usó sus 5 cambios" | Es correcto. El organizador no está bloqueado y puede hacer el cambio igual. |
| Falta gente para llenar una categoría | La capitana marca la **excepción** en esa categoría: permite alinear a alguien de categoría igual o más débil, o repetir jugador. Sale con ⚠️ en el rol. |

---

## Cuentas y accesos

| Situación | Qué hacer |
|---|---|
| "Olvidé mi contraseña" | Solo el **organizador** lo reinicia: ficha del jugador → *Acceso del jugador → Reiniciar*. Vuelve al primer acceso (nombre → últimos 4 dígitos del teléfono → contraseña nueva). |
| "No aparezco en la lista del login" | El selector muestra 40 nombres; hay que **escribir** para buscar. Si de verdad no está, falta su ficha en el roster. |
| Una capitana nueva no ve su panel | Marcar `is_captain` en su ficha y pedirle que **recargue**. El rol se deriva en vivo, no hace falta re-login. |

---

## "No me aparece lo nuevo en la app"

Es el service worker sirviendo la versión anterior. En orden:

1. Cerrar la app **del todo** (no minimizar) y volver a abrirla. Desde la
   migración de julio 2026 la app comprueba si hay versión nueva justo al
   volver a primer plano, así que esto basta casi siempre.
2. Si sigue: menú → **Actualizar**.
3. Si sigue: desinstalar la PWA y volver a añadirla a la pantalla de inicio.

---

## Cosas que NO son reversibles

- **Borrar un jugador o un equipo.** Durante la temporada las claves ajenas lo
  bloquean si ya tiene partidos o alineaciones — pero si pasa, no hay deshacer.
  Para sacar a alguien: **desactivar**, no borrar.
- **Reiniciar el draft.** Desasignaría a todos los jugadores de sus equipos.
  Desde la migración 0044 la base lo **rechaza** en cuanto la temporada tiene
  resultados o alineaciones publicadas, así que ya no es un riesgo real.

---

## Copia de seguridad

El plan de Supabase incluye **backup diario con 7 días de retención**. No hay
PITR (recuperación a un punto exacto), así que el peor caso realista es perder
las capturas de un día — recapturables desde las hojas de la jornada.

Después de cada jornada, un volcado del esquema `public` guardado **fuera de
Supabase** cubre el hueco. Los backups del proveedor no sirven si el problema es
un borrado accidental que nadie nota en 7 días.

---

## Cambios en la base

Las migraciones se aplican **a mano en el SQL Editor** de Supabase, en orden. No
uses `supabase db push` ni `db reset` contra este proyecto: el historial de la
CLI no incluye las migraciones de la liga y, además, **el mismo proyecto aloja
también el marcador** (schema `live`). Un reset se llevaría las dos apps.
