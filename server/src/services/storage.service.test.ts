import { describe, it, expect, vi } from 'vitest'
import { buildKey, uploadFile, downloadFile, deleteFile } from './storage.service'

function makeFetchStub(responses: Response[]) {
  let call = 0
  return vi.fn(async () => responses[call++])
}

describe('storage.service', () => {
  it('buildKey prefixes with service/env', () => {
    const key = buildKey('uploads/foo.zip')
    expect(key).toMatch(/^qm-personal-apps\/(dev|prd)\/uploads\/foo\.zip$/)
  })

  it('uploadFile POSTs the body to the bucket object endpoint', async () => {
    const fetchStub = makeFetchStub([new Response(null, { status: 200 })])

    const key = await uploadFile('uploads/foo.zip', Buffer.from('hello'), 'application/zip', fetchStub as unknown as typeof fetch)

    expect(key).toMatch(/uploads\/foo\.zip$/)
    expect(fetchStub).toHaveBeenCalledTimes(1)
    const [url, init] = fetchStub.mock.calls[0] as any[]
    expect(url).toContain('/storage/v1/object/')
    expect(init.method).toBe('POST')
    expect(init.headers.apikey).toBeDefined()
  })

  it('downloadFile GETs the object and returns bytes', async () => {
    const fetchStub = makeFetchStub([new Response(Buffer.from('data'), { status: 200 })])

    const buf = await downloadFile('uploads/foo.zip', fetchStub as unknown as typeof fetch)

    expect(buf.toString()).toBe('data')
  })

  it('uploadFile throws on non-ok response', async () => {
    const fetchStub = makeFetchStub([new Response(null, { status: 403 })])

    await expect(
      uploadFile('uploads/foo.zip', Buffer.from('x'), 'application/zip', fetchStub as unknown as typeof fetch)
    ).rejects.toThrow('업로드 실패: 403')
  })

  it('deleteFile DELETEs the object', async () => {
    const fetchStub = makeFetchStub([new Response(null, { status: 200 })])

    await deleteFile('uploads/foo.zip', fetchStub as unknown as typeof fetch)

    const [, init] = fetchStub.mock.calls[0] as any[]
    expect(init.method).toBe('DELETE')
  })
})
