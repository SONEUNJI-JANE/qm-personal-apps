import { config } from '../config'

const SERVICE_NAME = 'qm-personal-apps'
const ENV = config.NODE_ENV === 'production' ? 'prd' : 'dev'

export function buildKey(path: string): string {
  return `${SERVICE_NAME}/${ENV}/${path}`
}

async function getPresignedUrl(
  key: string,
  action: 'PUT_OBJECT' | 'GET_OBJECT' | 'DELETE_OBJECT',
  fetchImpl: typeof fetch
): Promise<string> {
  const response = await fetchImpl(`${config.S3_API_BASE_URL}/sign`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.S3_API_KEY,
    },
    body: JSON.stringify({ bucket: config.S3_BUCKET, key, action }),
  })

  if (!response.ok) {
    throw new Error(`Presigned URL 발급 실패: ${response.status}`)
  }

  const data = await response.json()
  return data.url
}

export async function uploadFile(
  path: string,
  body: Buffer,
  contentType: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const key = buildKey(path)
  const presignedUrl = await getPresignedUrl(key, 'PUT_OBJECT', fetchImpl)

  const response = await fetchImpl(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  })

  if (!response.ok) {
    throw new Error(`S3 업로드 실패: ${response.status}`)
  }

  return key
}

export async function downloadFile(path: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const key = path.startsWith(SERVICE_NAME) ? path : buildKey(path)
  const presignedUrl = await getPresignedUrl(key, 'GET_OBJECT', fetchImpl)

  const response = await fetchImpl(presignedUrl)
  if (!response.ok) {
    throw new Error(`S3 다운로드 실패: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function deleteFile(path: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const key = path.startsWith(SERVICE_NAME) ? path : buildKey(path)
  const presignedUrl = await getPresignedUrl(key, 'DELETE_OBJECT', fetchImpl)

  const response = await fetchImpl(presignedUrl, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`S3 삭제 실패: ${response.status}`)
  }
}
