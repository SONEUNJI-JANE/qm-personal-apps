import type { PersonalApp } from '../services/api'

export type SortField = 'name' | 'category' | 'uploader_email' | 'uploaded_at'
export type SortDirection = 'asc' | 'desc'

export function sortApps(apps: PersonalApp[], field: SortField, direction: SortDirection): PersonalApp[] {
  const sorted = [...apps].sort((a, b) => {
    const aVal = a[field] ?? ''
    const bVal = b[field] ?? ''
    if (aVal < bVal) return -1
    if (aVal > bVal) return 1
    return 0
  })
  return direction === 'asc' ? sorted : sorted.reverse()
}
