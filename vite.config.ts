/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// PWA: lectura offline del rol y la alineación en cancha (ver CLAUDE.md §1).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registramos el SW manualmente en main.tsx (con chequeo periódico de
      // actualización), así que no inyectamos el registro automático.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'logo-mark.png'],
      workbox: {
        // El SW nuevo toma control de inmediato y `autoUpdate` recarga la página
        // sola → el usuario siempre ve la última versión sin refresh manual.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Lectura offline del rol y la alineación en cancha — el objetivo
            // declarado de la PWA (CLAUDE.md §1), que hasta ahora no se cumplía:
            // solo se precacheaba el shell, así que sin señal la pantalla se
            // quedaba cargando y acababa en error.
            //
            // NetworkFirst y no CacheFirst: con señal SIEMPRE gana el dato
            // fresco; la caché solo entra si la red no responde en 4 s. En una
            // cancha con mala cobertura, esos 4 s son la diferencia entre ver el
            // rol y ver un spinner eterno.
            //
            // La lista de tablas es una LISTA BLANCA a propósito. Quedan fuera
            // `players` y `players_contact` (teléfonos) y `profiles`: cachear
            // respuestas con datos personales las dejaría legibles sin sesión
            // hasta que expire la caché. Lo que se cachea es lo que ya es
            // público o lo que el propio equipo necesita en cancha.
            urlPattern:
              /\/rest\/v1\/(rounds|matches|team_matchups|teams|match_categories|time_blocks|courts|seasons|players_public|team_standings|player_rankings|head_to_head|lineups|lineup_entries)\?/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'liga-datos',
              networkTimeoutSeconds: 4,
              // Un día: pasada una jornada, un dato viejo ya no ayuda.
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Liga de Pádel por Equipos',
        short_name: 'Liga Pádel',
        description: 'Rol, alineaciones, resultados y tabla de la liga de pádel por equipos.',
        lang: 'es',
        theme_color: '#10160f',
        background_color: '#10160f',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    css: false,
  },
})
