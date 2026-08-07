import { describe, it, expect } from 'vitest'
import { sortApps } from './sortApps'
import type { PersonalApp } from '../services/api'

const apps: PersonalApp[] = [
  { id: 1, name: 'B', description: null, s3_key: 'k', category: 'QA', original_filename: 'b.zip', file_size: 1, uploader_email: 'b@fnfcorp.com', uploader_name: null, uploaded_at: '2026-01-02' },
  { id: 2, name: 'A', description: null, s3_key: 'k', category: 'TD', original_filename: 'a.zip', file_size: 1, uploader_email: 'a@fnfcorp.com', uploader_name: null, uploaded_at: '2026-01-03' },
  { id: 3, name: 'C', description: null, s3_key: 'k', category: null, original_filename: 'c.zip', file_size: 1, uploader_email: 'c@fnfcorp.com', uploader_name: null, uploaded_at: '2026-01-01' },
]

describe('sortApps', () => {
  it('sorts by name ascending', () => {
    expect(sortApps(apps, 'name', 'asc').map(a => a.id)).toEqual([2, 1, 3])
  })

  it('sorts by name descending', () => {
    expect(sortApps(apps, 'name', 'desc').map(a => a.id)).toEqual([3, 1, 2])
  })

  it('sorts by uploaded_at ascending', () => {
    expect(sortApps(apps, 'uploaded_at', 'asc').map(a => a.id)).toEqual([3, 1, 2])
  })

  it('does not mutate the original array', () => {
    const copy = [...apps]
    sortApps(apps, 'name', 'asc')
    expect(apps).toEqual(copy)
  })
})
