import type { PersonalApp } from '../services/api'

export function filterApps(apps: PersonalApp[], category: string | null): PersonalApp[] {
  if (!category) return apps
  return apps.filter(app => app.category === category)
}
