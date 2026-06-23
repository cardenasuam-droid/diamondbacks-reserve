import { useCallback, useState } from 'react'
import { useActiveSeason } from '@/features/season/useActiveSeason'
import { useTeams } from '@/features/teams/useTeams'
import { useCategories } from '@/features/categories/useCategories'
import { useTimeBlocks, useCourts } from '@/features/import/catalogs'
import { CsvImporter } from '@/features/import/CsvImporter'
import { validateTeams } from '@/features/import/teamsImport'
import { validatePlayers } from '@/features/import/playersImport'
import { validateSchedule } from '@/features/import/scheduleImport'
import { useImportTeams, useImportPlayers, useImportSchedule } from '@/features/import/useImport'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Loader } from '@/components/ui/Loader'

type Tab = 'equipos' | 'jugadores' | 'rol'

const SAMPLES = {
  equipos: `team_name,color,logo_url,captain_email
Equipo Rojo,#D72638,,capitanrojo@email.com
Equipo Azul,#1B4DFF,,capitanazul@email.com`,
  jugadores: `full_name,email,phone,team_name,gender,category_code,is_captain
Juan Pérez,juan@email.com,6140000000,Equipo Rojo,male,VAR_5,false
Ana López,ana@email.com,6140000001,Equipo Rojo,female,FEM_4,true`,
  rol: `season_name,round_number,round_date,time_block,court_number,team_a,team_b,category_code
Liga 2026,1,2026-07-06,18:30,1,Equipo Rojo,Equipo Azul,VAR_4`,
}

export function OrganizerImportPage() {
  const [tab, setTab] = useState<Tab>('equipos')
  const season = useActiveSeason()
  const teams = useTeams(season.data?.id)
  const categories = useCategories()
  const timeBlocks = useTimeBlocks()
  const courts = useCourts()

  const importTeams = useImportTeams(season.data?.id)
  const importPlayers = useImportPlayers(season.data?.id)
  const importSchedule = useImportSchedule(season.data?.id)

  const teamList = teams.data ?? []
  const catList = categories.data ?? []

  const validateTeamsCb = useCallback(
    (rows: Record<string, string>[]) =>
      validateTeams(rows, teamList.map((t) => t.name)),
    [teamList],
  )
  const validatePlayersCb = useCallback(
    (rows: Record<string, string>[]) =>
      validatePlayers(rows, {
        teams: teamList.map((t) => ({ id: t.id, name: t.name })),
        categories: catList.map((c) => ({ code: c.code, type: c.type })),
      }),
    [teamList, catList],
  )
  const validateScheduleCb = useCallback(
    (rows: Record<string, string>[]) =>
      validateSchedule(rows, {
        seasonName: season.data?.name ?? '',
        teams: teamList.map((t) => ({ id: t.id, name: t.name })),
        categories: catList.map((c) => ({ code: c.code })),
        timeBlocks: (timeBlocks.data ?? []).map((t) => ({
          id: t.id,
          label: t.label,
          start_time: t.start_time,
        })),
        courts: (courts.data ?? []).map((c) => ({ id: c.id, number: c.number })),
      }),
    [season.data?.name, teamList, catList, timeBlocks.data, courts.data],
  )

  if (season.isLoading) return <Loader label="Cargando…" />
  if (!season.data) {
    return (
      <div>
        <PageHeader title="Importar CSV" />
        <EmptyState icon="import" title="No hay temporada activa" description="Activa una temporada para importar datos." />
      </div>
    )
  }

  const ctxLoading =
    teams.isLoading || categories.isLoading || timeBlocks.isLoading || courts.isLoading

  return (
    <div>
      <PageHeader title="Importar CSV" subtitle={season.data.name} />

      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
        {(['equipos', 'jugadores', 'rol'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              'rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ' +
              (tab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
        {tab === 'equipos' && 'Crea los equipos de la temporada. El capitán se marca en el CSV de jugadores.'}
        {tab === 'jugadores' && 'Carga los rosters. Importa primero los equipos. El género debe coincidir con la categoría.'}
        {tab === 'rol' && 'Importa el calendario completo. Requiere equipos cargados. Valida 27 partidos por jornada y sin choques de cancha.'}
      </div>

      {ctxLoading ? (
        <Loader label="Cargando catálogos…" />
      ) : tab === 'equipos' ? (
        <CsvImporter
          sample={SAMPLES.equipos}
          validate={validateTeamsCb}
          onImport={(valid) => importTeams.mutateAsync(valid)}
        />
      ) : tab === 'jugadores' ? (
        <CsvImporter
          sample={SAMPLES.jugadores}
          validate={validatePlayersCb}
          onImport={(valid) => importPlayers.mutateAsync(valid)}
        />
      ) : (
        <CsvImporter
          sample={SAMPLES.rol}
          validate={validateScheduleCb}
          onImport={(valid) => importSchedule.mutateAsync(valid)}
        />
      )}
    </div>
  )
}
