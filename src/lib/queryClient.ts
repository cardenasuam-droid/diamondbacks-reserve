import { QueryClient } from '@tanstack/react-query'

// Configuración global de TanStack Query. Datos deportivos cambian poco durante
// una sesión de cancha; staleTime moderado y reintentos conservadores.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
