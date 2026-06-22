# Sistema de diseño — Liga de Pádel ("Verde Cancha")

Guía visual de la app. Mobile-first, limpia y deportiva. Los tokens viven en
`src/styles/index.css` (Tailwind v4 `@theme`); aquí va el porqué y el cómo usarlos.

---

## 1. Paleta

### Marca — esmeralda (`brand-*`, también `sky-*`)
Color principal: enlaces, navegación activa, anillos de foco, hero, acentos.

| Token | Hex | Uso |
|---|---|---|
| `brand-50` | `#ecfdf5` | fondos suaves, chips |
| `brand-100` | `#d1fae5` | fondos de aviso/activo |
| `brand-600` | `#059669` | **color de marca** (enlaces, nav activa) |
| `brand-700` | `#047857` | hover, status bar (theme-color) |
| `brand-800/900` | `#065f46` / `#064e3b` | degradado del hero |

> `sky-*` está **remapeado** a la marca: el código antiguo que usa `text-sky-600`,
> `focus:ring-sky-200`, etc. ya se ve esmeralda. En código nuevo usa `brand-*`.

### Tinta y neutros — pizarra (`slate-*`)
- Texto principal `slate-900` (`#0f172a`), secundario `slate-600`, tenue `slate-400/500`.
- Fondo de app `slate-50` (`#f8fafc`), tarjetas `white`, bordes `slate-200`.
- **Botón primario = tinta** (`bg-slate-900`): se ve premium y deja que el verde
  sea el acento. (Si prefieres botones verdes, cambia `bg-slate-900`→`bg-brand-600`.)

### Acento — ámbar (`accent-*`)
Uso escaso, para destacar: ganador, "vigente", llamadas secundarias. `accent-500` `#f59e0b`.

### Semánticos
- Éxito: `emerald-600` · Error: `rose-600/700` (fondos `rose-50`) · Aviso: `amber-600` (fondos `amber-50`).
- Color por **equipo**: su hex propio, en línea (punto/franja). Helper `teamColor()` da un gris por defecto.

---

## 2. Tipografía

- Familia: stack del sistema (`--font-sans`), sin webfonts → rápido y offline.
  (Si más adelante quieres una fuente propia tipo *Inter*, se añade aquí.)
- Escala: título de página `text-2xl font-extrabold tracking-tight`; secciones
  `text-lg font-semibold`; cuerpo `text-sm`/`text-base`; metadatos `text-xs text-slate-400/500`.
- Números (marcadores, tablas): `tabular-nums` para que alineen.

---

## 3. Forma y profundidad

- Radios: tarjetas `rounded-xl`, hero/destacados `rounded-2xl`, chips/botones `rounded-lg`, puntos `rounded-full`.
- Sombra: `shadow-sm` en tarjetas (sutil). Evitar sombras fuertes.
- Bordes: `border border-slate-200` define las tarjetas sobre el fondo claro.
- Espaciado vertical entre bloques: `space-y-4` (móvil). Padding de tarjeta `p-4`/`p-5`.

---

## 4. Componentes (patrones)

- **Tarjeta:** `rounded-xl border border-slate-200 bg-white shadow-sm`.
- **Botón primario:** `rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50`.
- **Botón secundario:** `rounded-lg border border-slate-300 ... hover:bg-slate-100`.
- **Enlace/acción:** `text-brand-600 underline` (o `text-sm`).
- **Badge:** componente `Badge` (`components/ui/Badge`) con colores por tipo de categoría (`categoryColor`).
- **Estados:** `Loader`, `EmptyState`, `ErrorState`, `PageHeader` compartidos — úsalos siempre, no improvises.
- **Input:** `rounded-lg border border-slate-300 px-3 py-2 ... focus:border-brand-500 focus:ring-2 focus:ring-brand-200`.

---

## 5. Móvil / PWA

- **Safe areas:** utilidades `pt-safe` (cabeceras) y `pb-safe` (barra inferior)
  respetan notch y home indicator (`viewport-fit=cover` ya está en `index.html`).
- **Navegación inferior:** 4 accesos + **Menú (☰)** que abre el drawer con todo
  (`components/nav/`). Curada por rol (`primaryFor`).
- **Tap targets** ≥ 40px; sin flash gris (`-webkit-tap-highlight-color: transparent`).
- **Scroll horizontal** (selector de jornadas): clase `no-scrollbar`.
- `color-scheme: light` fuerza controles nativos claros; `theme-color`/manifest en `#047857`.

---

## 6. Reglas de oro

1. Una sola fuente para color, estados y navegación — reutiliza tokens y componentes compartidos.
2. Verde con mesura: marca y acentos, no "todo verde". Ámbar aún más escaso.
3. Privacidad: nunca muestres teléfono/correo en vistas públicas (RLS + UI).
4. Mobile-first: diseña a ~380px y deja que crezca; `max-w-3xl` centra en escritorio.
