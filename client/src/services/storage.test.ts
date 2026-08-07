import { describe, it, expect, vi } from 'vitest'
import { buildStorageKey, uploadFileDirect, publicDownloadUrl } from './storage'

describe('storage', () => {
  it('buildStorageKey produces an ASCII-safe key preserving the extension', () => {
    const key = buildStorageKey('패턴요청 자동회신.zip')
    expect(key).toMatch(/^qm-personal-apps\/prd\/uploads\/\d+-[0-9a-f-]+\.zip$/)
  })

  it('buildStorageKey drops a weird/unsafe extension', () => {
    const key = buildStorageKey('노확장자파일')
    expect(key).toMatch(/^qm-personal-apps\/prd\/uploads\/\d+-[0-9a-f-]+$/)
  })

  it('uploadFileDirect POSTs the file to the bucket object endpoint', async () => {
    const fetchStub = vi.fn(async () => new Response(null, { status: 200 }))
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })

    await uploadFileDirect(file, 'qm-personal-apps/prd/uploads/1-abc.txt', fetchStub as unknown as typeof fetch)

    expect(fetchStub).toHaveBeenCalledTimes(1)
    const [url, init] = fetchStub.mock.calls[0] as any[]
    expect(url).toContain('/storage/v1/object/')
    expect(init.method).toBe('POST')
    expect(init.headers.apikey).toBeDefined()
    expect(init.body).toBe(file)
  })

  it('uploadFileDirect throws with the status on failure', async () => {
    const fetchStub = vi.fn(async () => new Response(null, { status: 400 }))
    const file = new File(['x'], 'a.zip')

    await expect(
      uploadFileDirect(file, 'qm-personal-apps/prd/uploads/1-abc.zip', fetchStub as unknown as typeof fetch)
    ).rejects.toThrow('업로드 실패: 400')
  })

  it('publicDownloadUrl includes the public path and a download filename param', () => {
    const url = publicDownloadUrl('qm-personal-apps/prd/uploads/1-abc.zip', '패턴요청 자동회신.zip')
    expect(url).toContain('/storage/v1/object/public/')
    expect(url).toContain('download=')
    expect(decodeURIComponent(url.split('download=')[1])).toBe('패턴요청 자동회신.zip')
  })
})
