export type NewsAudience = 'public' | 'players' | 'captains' | 'team'

export interface NewsPost {
  id: string
  title: string
  body: string | null
  image_url: string | null
  audience: NewsAudience
  target_team_id: string | null
  published: boolean
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface LeagueDocument {
  id: string
  title: string
  file_url: string
  document_type: string
  version: string | null
  is_active: boolean
  created_at: string
}
