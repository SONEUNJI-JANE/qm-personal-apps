import { config } from '../config'

const SERVICE_NAME = 'qm-personal-apps'
const ENV = config.NODE_ENV === 'production' ? 'prd' : 'dev'

export function buildKey(path: string): string {
  return `${SERVICE_NAME}/${ENV}/${path}`
}

function objectUrl(key: string): string {
  return `${config.SUPABASE_URL}/storage/v1/object/${config.SUPABASE_STORAGE_BUCKET}/${key}`
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: config.SUPABASE_KEY,
    Authorization: `Bearer ${config.SUPABASE_KEY}`,
    ...extra,
  }
}

export async function uploadFile(
  path: string,
  body: Buffer,
  contentType: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const key = buildKey(path)

  const response = await fetchImpl(objectUrl(key), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': contentType, 'x-upsert': 'true' }),
    body: body as unknown as BodyInit,
  })

  if (!response.ok) {
    throw new Error(`업로드 실패: ${response.status}`)
  }

  return key
}

export async function downloadFile(path: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const key = path.startsWith(SERVICE_NAME) ? path : buildKey(path)

  const response = await fetchImpl(objectUrl(key), { headers: authHeaders() })
  if (!response.ok) {
    throw new Error(`다운로드 실패: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function deleteFile(path: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const key = path.startsWith(SERVICE_NAME) ? path : buildKey(path)

  const response = await fetchImpl(objectUrl(key), { method: 'DELETE', headers: authHeaders() })
  if (!response.ok) {
    throw new Error(`삭제 실패: ${response.status}`)
  }
}
