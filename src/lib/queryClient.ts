import { QueryClient } from '@tanstack/react-query'

// Configuración global de TanStack Query. Clave para móvil/PWA: refrescar al
// VOLVER a la app (refetchOnWindowFocus) y al reconectar, con staleTime corto
// para que ese refresco realmente ocurra (antes quedaban datos viejos al reabrir).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 5 * 60_000,
      // Con el timeout del cliente Supabase, una petición colgada ahora se aborta
      // y se rechaza; el retry la reintenta en vez de dejar la UI en "Cargando…".
      // Backoff acotado para no amplificar la carga en el pico.
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8_000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
})
