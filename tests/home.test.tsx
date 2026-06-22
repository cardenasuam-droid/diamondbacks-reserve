import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from '@/routes/public/HomePage'

// HomePage usa TanStack Query (temporada activa) y react-router (Link), así que
// se renderiza dentro de sus providers.
function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('HomePage', () => {
  it('renderiza el título de la liga', () => {
    renderWithProviders(<HomePage />)
    expect(
      screen.getByRole('heading', { name: /liga de pádel por equipos/i }),
    ).toBeInTheDocument()
  })
})
