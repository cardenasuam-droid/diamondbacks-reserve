# Rollout — Rol Co-capitán (migración 0034)

Agrega el rol **co-capitán**: un segundo referente por equipo con EXACTAMENTE los
mismos accesos que el capitán (alineaciones, contactos de su equipo, picks del
draft, panel de capitán). Se distingue con la etiqueta "Co-capitán".

## Diseño (por qué no toca guards ni el enum de roles)

El co-capitán lleva `profiles.role = 'captain'` (accesos idénticos, sin cambiar
`RequireRole` ni políticas por rol) y se marca con la bandera
`players.is_cocaptain`, que da la etiqueta. Casi todos los permisos del capitán
fluyen por la función SQL `captain_team_id()`; `0034` la hace contar también al
co-capitán, así hereda de golpe la RLS de alineaciones/jugadores/contactos, el RPC
`save_lineup` y el `make_pick` del draft.

## Cambio ACOPLADO BD + cliente

Aplica `0034_cocaptain.sql` y despliega el cliente **juntos**. El cliente pide la
columna `is_cocaptain` de forma explícita en el panel de capitán
(`useCaptainTeam`) y en el roster del organizador (`useManageRoster`); sin la
migración, esas pantallas dan error (las páginas PÚBLICAS sí degradan bien porque
leen `players_public` con `select('*')`).

## Aplicar

1. Aplica la migración al proyecto `qckqjrffrarktosixzdf` (SQL Editor o
   `supabase db push`). Es idempotente y no toca el schema `live` (padelscore-live).
2. Despliega el cliente (esta rama) a Netlify a la vez.

## Qué hace la migración 0034

- `players.is_cocaptain` (bool) + índice único `one_cocaptain_per_team` (uno por
  equipo) + checks (no capitán-y-co-capitán a la vez; el co-capitán tiene equipo).
- `captain_team_id()`: cuenta capitán O co-capitán.
- `handle_new_user` y `sync_captain_role`: el co-capitán entra/queda con rol
  'captain'; el trigger de sync ahora dispara también al cambiar `is_cocaptain`.
- `players_public`: expone `is_cocaptain` (para el badge).

## Probar (tras aplicar)

1. Organizador → Equipos → un equipo → edita a un jugador y marca **Co-capitán**
   (Capitán y Co-capitán son excluyentes). Guarda.
2. Ese jugador cierra sesión y vuelve a entrar (para refrescar el rol del perfil).
   Debe ver el **panel de capitán** (`/app/capitan`), poder **armar alineación** y,
   en un draft activo, **hacer los picks** de su equipo en su turno.
3. En el roster público del equipo y en su ficha aparece el badge **"Co-capitán"**.

## Notas / follow-ups (fuera de alcance de "mismos accesos")

- **Draft "no pick" (is_skip):** `begin_category` (0028) da un slot menos al equipo
  por su CAPITÁN pre-rosterado. Si en un futuro draft un equipo lleva capitán Y
  co-capitán pre-asignados en la misma categoría, la lógica actual solo descuenta
  al capitán (el sobrante lo recorta la poda, sin cuelgues, pero el equipo podría
  quedar con un pick real de menos). El draft de esta temporada está finalizado;
  ajustar `begin_category` para contar co-capitanes es un follow-up si se replantea
  el formato de draft.
- **Import CSV:** no trae columna de co-capitán; se asigna desde el formulario del
  organizador tras importar.
