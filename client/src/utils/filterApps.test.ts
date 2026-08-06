import { describe, it, expect } from 'vitest'
import { filterApps } from './filterApps'
import type { PersonalApp } from '../services/api'

const apps: PersonalApp[] = [
  { id: 1, name: 'A', description: null, category: 'TD', original_filename: 'a.zip', file_size: 1, uploader_email: 'a@fnfcorp.com', uploaded_at: '2026-01-01' },
  { id: 2, name: 'B', description: null, category: 'QA', original_filename: 'b.zip', file_size: 1, uploader_email: 'b@fnfcorp.com', uploaded_at: '2026-01-02' },
  { id: 3, name: 'C', description: null, category: 'TD', original_filename: 'c.zip', file_size: 1, uploader_email: 'c@fnfcorp.com', uploaded_at: '2026-01-03' },
]

describe('filterApps', () => {
  it('returns all apps when category is null', () => {
    expect(filterApps(apps, null)).toHaveLength(3)
  })

  it('returns only matching category', () => {
    const result = filterApps(apps, 'TD')
    expect(result.map(a => a.id)).toEqual([1, 3])
  })

  it('returns empty array when no app matches', () => {
    expect(filterApps(apps, '없는카테고리')).toEqual([])
  })
})
