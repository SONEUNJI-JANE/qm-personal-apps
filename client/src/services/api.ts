export interface PersonalApp {
  id: number
  name: string
  description: string | null
  category: string | null
  s3_key: string
  original_filename: string
  file_size: number
  uploader_email: string
  uploader_name: string | null
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

export async function createAppRecord(fields: {
  name: string
  description: string
  category: string
  uploaderEmail: string
  uploaderName: string
  s3Key: string
  originalFilename: string
  fileSize: number
}): Promise<PersonalApp> {
  const res = await fetch('/api/personal-apps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  const body: ApiResponse<PersonalApp> = await res.json()
  if (!body.success || !body.data) throw new Error(body.error || 'Save failed')
  return body.data
}

export async function deleteApp(id: number): Promise<void> {
  const res = await fetch(`/api/personal-apps/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
}
