import { config } from '../config'

function objectUrl(key: string): string {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/')
  return `${config.SUPABASE_URL}/storage/v1/object/${config.SUPABASE_STORAGE_BUCKET}/${encodedKey}`
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: config.SUPABASE_KEY,
    Authorization: `Bearer ${config.SUPABASE_KEY}`,
    ...extra,
  }
}

export async function deleteFile(key: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const response = await fetchImpl(objectUrl(key), { method: 'DELETE', headers: authHeaders() })
  if (!response.ok) {
    throw new Error(`삭제 실패: ${response.status}`)
  }
}
