# Login — configuración (elige tu nombre + contraseña)

> **No necesitas SMTP/Resend.** El login ya no usa códigos por correo. Cada jugador
> elige su nombre de la lista, confirma con los últimos 4 dígitos de su teléfono
> (solo la primera vez) y crea una contraseña.

Por debajo es email+contraseña de Supabase, pero el email es **sintético**
(`<player_id>@players.local`): el jugador nunca lo ve. La verificación del teléfono
es del lado servidor (no se expone el teléfono).

---

## Parte 0 — Aplicar migraciones (SQL Editor)

En orden, pega y ejecuta el contenido de:

1. `supabase/migrations/0006_captain_lineups.sql` — RLS de capitán.
2. `supabase/migrations/0007_save_lineup_rpc.sql` — RPC de guardado de alineación.
3. `supabase/migrations/0008_password_auth.sql` — login por contraseña + verificación.
4. `supabase/migrations/0009_staff_members.sql` — lista de staff (acceso por código).

## Parte 1 — Ajustes de Auth en Supabase

Authentication → **Providers → Email**:

- **Enable Email provider:** ON.
- **Confirm email:** **OFF** ← imprescindible. Así el alta entra con sesión al
  instante, sin enviar ningún correo.
- Minimum password length: 6 (la app pide ≥ 6).

No hace falta SMTP ni plantillas de correo.

## Parte 2 — Datos con teléfono

La verificación usa los **últimos 4 dígitos del teléfono** de la ficha del jugador
(`players.phone`). Asegúrate de que el roster tenga teléfonos:

- El CSV de jugadores incluye la columna `phone` (impórtalo desde el panel del
  organizador → Importar CSV).
- Si un jugador no tiene teléfono, no podrá registrarse hasta que el organizador se
  lo agregue.

> El `demo_seed.sql` **no** trae teléfonos, así que sus jugadores no pueden
> registrarse. Para probar, usa el acceso de staff (abajo) o carga jugadores reales
> con teléfono.

## Parte 3 — Organizador / staff (lista + código)

El organizador y el web manager normalmente no están en el roster, así que viven en
la tabla **`staff_members`** y entran con el **mismo selector de nombres**, pero su
verificación de primer acceso es un **código** (no tienen teléfono).

**Bootstrap (arrancar tú mismo)** — SQL Editor:

```sql
insert into staff_members (full_name, role, access_code)
values ('Tu Nombre', 'organizer', 'ELIGE-UN-CODIGO');
```

Luego en la app: `/login` → busca tu nombre → escribe ese código → crea contraseña.
Quedas con rol `organizer` automáticamente. La **lista completa de staff** se carga
después (más filas en `staff_members`, o desde el panel cuando exista ese módulo).

> **Respaldo de emergencia por correo** (oculto): si alguna vez se pierde el acceso,
> crea un usuario en Supabase → Authentication → Users → Add user (auto-confirm),
> haz `update profiles set role='organizer' where email='...'`, y entra por el enlace
> discreto "Acceso por correo" en `/login`.

## Parte 4 — Probar de punta a punta

1. `npm run dev` → `/login`.
2. **Jugador:** busca tu nombre → primera vez: últimos 4 del teléfono + nueva
   contraseña → entras. Siguientes veces: nombre + contraseña.
3. **Staff/organizador:** busca tu nombre → escribe tu código → crea contraseña.
4. **Capitán:** importa un equipo + un jugador `is_captain=true` con un teléfono
   tuyo; regístrate con ese nombre. El rol capitán se asigna solo.

## Solución de problemas

- **Al elegir un jugador sale "No se pudo comprobar la cuenta"** → falta aplicar la
  migración 0008 (la RPC `player_has_account` no existe aún).
- **"Los últimos 4 dígitos no coinciden"** → revisa `players.phone` del jugador.
- **"Este jugador no tiene teléfono registrado"** → agrégale el teléfono.
- **El alta no entra / "Database error saving new user"** → casi siempre es
  *Confirm email* en ON (ponlo OFF) o un dato que no pasa la verificación.
- **El error real**: en `npm run dev`, abre la consola del navegador.
- **Reset de contraseña**: no hay autoservicio (no hay correo real). El organizador
  la cambia desde Supabase → Authentication → Users.
