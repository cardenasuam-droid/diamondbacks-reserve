import { createBrowserRouter } from 'react-router-dom'
import { PublicLayout } from './public/PublicLayout'
import { HomePage } from './public/HomePage'
import { SchedulePage } from './public/SchedulePage'
import { ResultsPage } from './public/ResultsPage'
import { StandingsPage } from './public/StandingsPage'
import { TeamsPage } from './public/TeamsPage'
import { TeamRosterPage } from './public/TeamRosterPage'
import { PlayerDetailPage } from './public/PlayerDetailPage'
import { StatsPage } from './public/StatsPage'
import { NewsListPage } from './public/NewsListPage'
import { NewsDetailPage } from './public/NewsDetailPage'
import { ReglamentoPage } from './public/ReglamentoPage'
import { MorePage } from './public/MorePage'
import { DevPage } from './dev/DevPage'
import { NotFoundPage } from './NotFoundPage'
import { LoginPage } from './auth/LoginPage'
import { RegisterPage } from './registro/RegisterPage'
import { RequireAuth, RequireRole } from './guards'
import { AppLayout } from './app/AppLayout'
import { AccountPage } from './app/AccountPage'
import { AvisosPage } from './app/AvisosPage'
import { CaptainDashboard } from './captain/CaptainDashboard'
import { LineupEditorPage } from './captain/LineupEditorPage'
import { OrganizerDashboard } from './organizer/OrganizerDashboard'
import { OrganizerLineupsPage } from './organizer/OrganizerLineupsPage'
import { OrganizerResultsPage } from './organizer/OrganizerResultsPage'
import { OrganizerImportPage } from './organizer/OrganizerImportPage'
import { OrganizerTeamsPage } from './organizer/OrganizerTeamsPage'
import { OrganizerRosterPage } from './organizer/OrganizerRosterPage'
import { OrganizerRegistrationsPage } from './organizer/OrganizerRegistrationsPage'
import { NewsManagerPage } from './content/NewsManagerPage'
import { ReglamentoManagerPage } from './content/ReglamentoManagerPage'
import { AvisosManagerPage } from './content/AvisosManagerPage'

// Rutas separadas por audiencia (CLAUDE.md §5).
//   '/'      público con nav inferior (Inicio · Rol · Resultados · Tabla · Más)
//   '/login' alta/entrada por OTP
//   '/app'   área autenticada (RequireAuth). Paneles por rol llegan en su módulo.
export const router = createBrowserRouter([
  // Inscripción pública AISLADA: su propia pantalla, sin el shell con menú ni
  // login. Un link aparte (/registro) que comparte la base de datos pero no da
  // acceso a la app.
  { path: '/registro', element: <RegisterPage /> },
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'rol', element: <SchedulePage /> },
      { path: 'resultados', element: <ResultsPage /> },
      { path: 'tabla', element: <StandingsPage /> },
      { path: 'equipos', element: <TeamsPage /> },
      { path: 'equipos/:teamId', element: <TeamRosterPage /> },
      { path: 'jugadores/:playerId', element: <PlayerDetailPage /> },
      { path: 'estadisticas', element: <StatsPage /> },
      { path: 'noticias', element: <NewsListPage /> },
      { path: 'noticias/:newsId', element: <NewsDetailPage /> },
      { path: 'reglamento', element: <ReglamentoPage /> },
      { path: 'mas', element: <MorePage /> },
      { path: 'dev', element: <DevPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/app',
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <AccountPage /> },
          { path: 'avisos', element: <AvisosPage /> },
          {
            path: 'capitan',
            element: <RequireRole roles={['captain', 'organizer']} />,
            children: [
              { index: true, element: <CaptainDashboard /> },
              { path: 'alineacion', element: <LineupEditorPage /> },
            ],
          },
          {
            path: 'organizador',
            element: <RequireRole roles={['organizer']} />,
            children: [
              { index: true, element: <OrganizerDashboard /> },
              { path: 'inscripciones', element: <OrganizerRegistrationsPage /> },
              { path: 'alineaciones', element: <OrganizerLineupsPage /> },
              { path: 'resultados', element: <OrganizerResultsPage /> },
              { path: 'importar', element: <OrganizerImportPage /> },
              { path: 'equipos', element: <OrganizerTeamsPage /> },
              { path: 'equipos/:teamId', element: <OrganizerRosterPage /> },
            ],
          },
          {
            path: 'contenido',
            element: <RequireRole roles={['organizer', 'web_manager']} />,
            children: [
              { index: true, element: <NewsManagerPage /> },
              { path: 'reglamento', element: <ReglamentoManagerPage /> },
              { path: 'avisos', element: <AvisosManagerPage /> },
            ],
          },
        ],
      },
    ],
  },
])
