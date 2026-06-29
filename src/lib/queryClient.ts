import { QueryClient } from '@tanstack/react-query'

// Configuración global de TanStack Query. Clave para móvil/PWA: refrescar al
// VOLVER a la app (refetchOnWindowFocus) y al reconectar, con staleTime corto
// para que ese refresco realmente ocurra (antes quedaban datos viejos al reabrir).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
})
