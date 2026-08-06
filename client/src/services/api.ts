export interface PersonalApp {
  id: number
  name: string
  description: string | null
  category: string | null
  original_filename: string
  file_size: number
  uploader_email: string
  uploaded_at: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export async function listApps(category?: string): Promise<PersonalApp[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : ''
  const res = await fetch(`/api/personal-apps${qs}`)
  const body: ApiResponse<PersonalApp[]> = await res.json()
  if (!body.success || !body.data) throw new Error(body.error || 'Failed to load apps')
  return body.data
}

export async function uploadApp(
  file: File,
  fields: { name: string; description: string; category: string; uploaderEmail: string }
): Promise<PersonalApp> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('name', fields.name)
  formData.append('description', fields.description)
  formData.append('category', fields.category)
  formData.append('uploaderEmail', fields.uploaderEmail)

  const res = await fetch('/api/personal-apps', { method: 'POST', body: formData })
  const body: ApiResponse<PersonalApp> = await res.json()
  if (!body.success || !body.data) throw new Error(body.error || 'Upload failed')
  return body.data
}

export function downloadAppUrl(id: number): string {
  return `/api/personal-apps/${id}/download`
}

export async function deleteApp(id: number): Promise<void> {
  const res = await fetch(`/api/personal-apps/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
}
