# Despliegue en Netlify

La app es una SPA (Vite + React) con backend Supabase. Ya está todo configurado
(`netlify.toml` + `public/_redirects`). Solo falta conectar tu cuenta y las
variables de entorno.

> Las claves del frontend (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) son
> públicas por diseño: la anon key se incrusta en el build y los datos los protege
> RLS. La `service_role` NUNCA va aquí.

---

## Antes de desplegar (una vez)

1. En el proyecto Supabase al que apuntará el sitio, aplica las migraciones
   pendientes en el SQL Editor: **0006 → 0011**.
2. Authentication → Providers → Email: **Confirm email OFF** (la 0010 ya crea el
   bucket `media`).
3. Decide el proyecto Supabase: por ahora puedes usar el de "dev"; en el
   lanzamiento real conviene clonar a uno "prod" (CLAUDE.md §3.1) y usar sus claves.

---

## Opción A — Git + Netlify (recomendado, deploy continuo)

1. Inicializa git y sube el repo a GitHub:
   ```bash
   git init && git add . && git commit -m "App liga de pádel"
   gh repo create liga-padel --private --source=. --push
   ```
   (`.env` está en `.gitignore`; no se sube.)
2. En Netlify: **Add new site → Import an existing project** → elige el repo.
   Build command y publish dir los toma de `netlify.toml` (`npm run build` → `dist`).
3. **Site settings → Environment variables**, añade:
   - `VITE_SUPABASE_URL` = tu URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` = tu anon/publishable key
4. **Deploy**. Cada push a la rama desplegará solo.

## Opción B — Netlify CLI

```bash
npm i -g netlify-cli
netlify login
netlify init           # enlaza/crea el sitio
netlify env:set VITE_SUPABASE_URL "https://....supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "sb_publishable_..."
netlify deploy --build --prod
```

## Opción C — Arrastrar y soltar (lo más rápido, sin git)

1. Con tu `.env` local presente (ya trae las claves), compila:
   ```bash
   npm run build
   ```
2. Ve a <https://app.netlify.com/drop> y arrastra la carpeta **`dist`**.
   El `_redirects` ya va dentro, así que las rutas profundas funcionan.

> En esta opción las claves quedan "horneadas" desde tu `.env` local; para
> cambiarlas hay que recompilar y volver a soltar. Para algo continuo usa A o B.

---

## Después del primer deploy

1. Copia la URL del sitio (p. ej. `https://liga-padel.netlify.app`).
2. Supabase → Authentication → URL Configuration → **Site URL** = esa URL
   (y agrégala a *Redirect URLs*).
3. Prueba: abre la URL, entra (staff por código o jugador por teléfono), y
   verifica rol/alineaciones/resultados.

## Notas

- PWA: el service worker y el manifest se generan en `dist`; Netlify los sirve tal
  cual. La fuente (Plus Jakarta Sans) se cachea offline.
- Si el build falla por versión de Node, `netlify.toml` ya fija `NODE_VERSION=22`.
