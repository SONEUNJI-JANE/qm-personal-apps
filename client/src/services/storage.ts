const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string
const BUCKET = (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string) || 'personal-apps'

const SERVICE_NAME = 'qm-personal-apps'

function safeExtension(filename: string): string {
  const match = filename.match(/\.[a-zA-Z0-9]{1,10}$/)
  return match ? match[0] : ''
}

export function buildStorageKey(filename: string): string {
  const uuid = crypto.randomUUID()
  return `${SERVICE_NAME}/prd/uploads/${Date.now()}-${uuid}${safeExtension(filename)}`
}

function objectUrl(key: string): string {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/')
  return `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodedKey}`
}

export async function uploadFileDirect(
  file: File,
  key: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const res = await fetchImpl(objectUrl(key), {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  })

  if (!res.ok) {
    throw new Error(`업로드 실패: ${res.status}`)
  }
}

export function publicDownloadUrl(key: string, downloadFilename: string): string {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/')
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodedKey}?download=${encodeURIComponent(downloadFilename)}`
}
