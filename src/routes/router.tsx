import { createBrowserRouter } from 'react-router-dom'
import { PublicLayout } from './public/PublicLayout'
import { LeagueGate } from './public/LeagueGate'
import { LeagueSelectPage } from './public/LeagueSelectPage'
import { RouteError } from './RouteError'
import { SchedulePage } from './public/SchedulePage'
import { MatchDetailPage } from './public/MatchDetailPage'
import { ResultsPage } from './public/ResultsPage'
import { StandingsPage } from './public/StandingsPage'
import { TeamsPage } from './public/TeamsPage'
import { TeamRosterPage } from './public/TeamRosterPage'
import { PlayersPage } from './public/PlayersPage'
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
import { RegistrationHubPage } from './registro/RegistrationHubPage'
import { RegisterAmericanoPage } from './registro/RegisterAmericanoPage'
import { RegistrationStatusPage } from './registro/RegistrationStatusPage'
import { LeagueLandingPage } from './public/LeagueLandingPage'
import { AmericanoSchedulePage } from './public/AmericanoSchedulePage'
import { AmericanoStandingsPage } from './public/AmericanoStandingsPage'
import { AmericanoAdminPage } from './organizer/AmericanoAdminPage'
import { DraftPage } from './draft/DraftPage'
import { RequireAuth, RequireRole } from './guards'
import { AppLayout } from './app/AppLayout'
import { AccountPage } from './app/AccountPage'
import { AvisosPage } from './app/AvisosPage'
import { CaptainDashboard } from './captain/CaptainDashboard'
import { LineupEditorPage } from './captain/LineupEditorPage'
import { CaptainResultsPage } from './captain/CaptainResultsPage'
import { CambiosPage } from './app/CambiosPage'
import { OrganizerDashboard } from './organizer/OrganizerDashboard'
import { OrganizerLineupsPage } from './organizer/OrganizerLineupsPage'
import { OrganizerResultsPage } from './organizer/OrganizerResultsPage'
import { OrganizerRatingPage } from './organizer/OrganizerRatingPage'
import { OrganizerImportPage } from './organizer/OrganizerImportPage'
import { OrganizerTeamsPage } from './organizer/OrganizerTeamsPage'
import { OrganizerRosterPage } from './organizer/OrganizerRosterPage'
import { OrganizerRegistrationsPage } from './organizer/OrganizerRegistrationsPage'
import { OrganizerDraftPage } from './organizer/OrganizerDraftPage'
import { OrganizerPoolPage } from './organizer/OrganizerPoolPage'
import { OrganizerWaitlistPage } from './organizer/OrganizerWaitlistPage'
import { NewsManagerPage } from './content/NewsManagerPage'
import { ReglamentoManagerPage } from './content/ReglamentoManagerPage'
import { AvisosManagerPage } from './content/AvisosManagerPage'

// Rutas separadas por audiencia (CLAUDE.md §5).
//   '/'      público con nav inferior (Inicio · Rol · Resultados · Tabla · Más)
//   '/login' alta/entrada por OTP
//   '/app'   área autenticada (RequireAuth). Paneles por rol llegan en su módulo.
export const router = createBrowserRouter([
  // Inscripción pública AISLADA: su propia pantalla, sin el shell con menú ni
  // login. /registro es un hub multi-liga (0049): con una sola edición abierta
  // redirige a su formulario; 'reserve' (estático) gana sobre ':leagueSlug'.
  { path: '/registro', element: <RegistrationHubPage /> },
  { path: '/registro/reserve', element: <RegisterPage /> },
  { path: '/registro/:leagueSlug', element: <RegisterAmericanoPage /> },
  // "Mi inscripción" (0057): estado por token del enlace mágico o del guardado
  // en el dispositivo; también aislada, con el tema de la liga.
  { path: '/registro/:leagueSlug/estado', element: <RegistrationStatusPage /> },
  // Selector de ligas: la puerta de la plataforma, AISLADA del shell de
  // Reserve (identidad neutral del club). "Cambiar de liga" apunta aquí.
  { path: '/ligas', element: <LeagueSelectPage /> },
  // Páginas públicas de la Liga Femenil (F1/F2): landing, rol y tabla, con la
  // identidad de la liga. En F4 se cuelgan del selector liga→edición.
  { path: '/femenil', element: <LeagueLandingPage slug="femenil" /> },
  { path: '/femenil/rol', element: <AmericanoSchedulePage slug="femenil" /> },
  { path: '/femenil/tabla', element: <AmericanoStandingsPage slug="femenil" /> },
  // Draft en vivo: board público + participante (capitanas eligen en su turno).
  { path: '/draft', element: <DraftPage /> },
  {
    path: '/',
    element: <PublicLayout />,
    // Red de seguridad: cualquier throw dentro del área pública cae aquí en vez
    // de en la pantalla por defecto de react-router (en inglés y sin salida).
    errorElement: <RouteError />,
    children: [
      // Plataforma multi-liga: '/' resuelve primero la LIGA (recordada en el
      // dispositivo, o manda al selector /ligas) y luego el destino en ella.
      { index: true, element: <LeagueGate /> },
      { path: 'rol', element: <SchedulePage /> },
      { path: 'partidos/:matchId', element: <MatchDetailPage /> },
      { path: 'resultados', element: <ResultsPage /> },
      { path: 'tabla', element: <StandingsPage /> },
      { path: 'equipos', element: <TeamsPage /> },
      { path: 'equipos/:teamId', element: <TeamRosterPage /> },
      { path: 'jugadores', element: <PlayersPage /> },
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
    errorElement: <RouteError />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <AccountPage /> },
          { path: 'avisos', element: <AvisosPage /> },
          {
            // Pool de jugadores: visible para capitanas y organizador (página
            // consciente del rol). Las capitanas lo ven de solo lectura.
            path: 'pool',
            element: <RequireRole roles={['captain', 'organizer', 'viewer']} />,
            children: [{ index: true, element: <OrganizerPoolPage /> }],
          },
          {
            // Swaps y dobleteos: transparencia para capitanas, organizador y
            // observador (todas ven los conteos de todos los equipos).
            path: 'cambios',
            element: <RequireRole roles={['captain', 'organizer', 'viewer']} />,
            children: [{ index: true, element: <CambiosPage /> }],
          },
          {
            path: 'capitan',
            element: <RequireRole roles={['captain', 'organizer']} />,
            children: [
              { index: true, element: <CaptainDashboard /> },
              { path: 'alineacion', element: <LineupEditorPage /> },
              // Captura de resultados por la capitana (reporta; el organizador valida).
              { path: 'resultados', element: <CaptainResultsPage /> },
            ],
          },
          {
            path: 'organizador',
            element: <RequireRole roles={['organizer', 'viewer']} />,
            children: [
              { index: true, element: <OrganizerDashboard /> },
              { path: 'inscripciones', element: <OrganizerRegistrationsPage /> },
              { path: 'lista-espera', element: <OrganizerWaitlistPage /> },
              { path: 'draft', element: <OrganizerDraftPage /> },
              { path: 'alineaciones', element: <OrganizerLineupsPage /> },
              // El organizador edita el rol de cualquier equipo (reusa el editor
              // del capitán en "modo organizador": sin candado). Solo organizer.
              { path: 'alineaciones/:teamMatchupId/editar/:teamId', element: <LineupEditorPage /> },
              { path: 'resultados', element: <OrganizerResultsPage /> },
              { path: 'rating', element: <OrganizerRatingPage /> },
              { path: 'importar', element: <OrganizerImportPage /> },
              { path: 'equipos', element: <OrganizerTeamsPage /> },
              { path: 'equipos/:teamId', element: <OrganizerRosterPage /> },
              // Ligas formato americano (0051): jornadas, juegos, resultados.
              { path: 'liga/:leagueSlug', element: <AmericanoAdminPage /> },
            ],
          },
          {
            path: 'contenido',
            element: <RequireRole roles={['organizer', 'web_manager', 'viewer']} />,
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
