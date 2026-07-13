import { registrationSchema } from '@/features/registration/schema'
import { rankingCategories, genderForCategoryType } from '@/features/registration/category'
import type { MatchCategory } from '@/lib/types'

const valid = {
  fullName: 'Ana Gómez Ruiz',
  phone: '55 1234 5678',
  categoryCode: 'VAR_5',
  position: 'ambas',
  shirtSize: 'M',
}

describe('registrationSchema', () => {
  it('acepta una inscripción completa', () => {
    expect(registrationSchema.safeParse(valid).success).toBe(true)
  })

  it('rechaza nombre demasiado corto', () => {
    const r = registrationSchema.safeParse({ ...valid, fullName: 'A' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path[0]).toBe('fullName')
  })

  it('exige teléfono con al menos 7 dígitos', () => {
    expect(registrationSchema.safeParse({ ...valid, phone: '' }).success).toBe(false)
    expect(registrationSchema.safeParse({ ...valid, phone: '12345' }).success).toBe(false)
    // Formato libre con suficientes dígitos: válido.
    expect(registrationSchema.safeParse({ ...valid, phone: '+52 (55) 1234-5678' }).success).toBe(true)
  })

  it('exige elegir categoría', () => {
    const r = registrationSchema.safeParse({ ...valid, categoryCode: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path[0]).toBe('categoryCode')
  })

  it('solo acepta posiciones válidas', () => {
    for (const p of ['drive', 'reves', 'ambas']) {
      expect(registrationSchema.safeParse({ ...valid, position: p }).success).toBe(true)
    }
    expect(registrationSchema.safeParse({ ...valid, position: 'zurda' }).success).toBe(false)
    expect(registrationSchema.safeParse({ ...valid, position: '' }).success).toBe(false)
  })

  it('exige una talla de playera válida', () => {
    for (const s of ['XS', 'S', 'M', 'L', 'XL', 'XXL']) {
      expect(registrationSchema.safeParse({ ...valid, shirtSize: s }).success).toBe(true)
    }
    expect(registrationSchema.safeParse({ ...valid, shirtSize: 'XXXL' }).success).toBe(false)
    expect(registrationSchema.safeParse({ ...valid, shirtSize: '' }).success).toBe(false)
  })
})

const cat = (code: string, type: MatchCategory['type'], sort_order: number, is_active = true): MatchCategory => ({
  code,
  name: code,
  type,
  sort_order,
  is_active,
  is_ranking: type !== 'mixta',
  is_match: true,
  match_sort_order: null,
})

describe('rankingCategories', () => {
  it('excluye categorías mixtas e inactivas y ordena por sort_order', () => {
    const input = [
      cat('MIX_A', 'mixta', 8),
      cat('VAR_5', 'varonil', 2),
      cat('FEM_4', 'femenil', 4),
      cat('VAR_4', 'varonil', 1),
      cat('FEM_5', 'femenil', 5, false),
    ]
    const out = rankingCategories(input)
    expect(out.map((c) => c.code)).toEqual(['VAR_4', 'VAR_5', 'FEM_4'])
  })
})

describe('genderForCategoryType', () => {
  it('deriva el género del tipo de categoría', () => {
    expect(genderForCategoryType('varonil')).toBe('male')
    expect(genderForCategoryType('femenil')).toBe('female')
    expect(genderForCategoryType('mixta')).toBe(null)
  })
})
