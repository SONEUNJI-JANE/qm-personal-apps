import { describe, it, expect, vi } from 'vitest'
import { buildKey, uploadFile, downloadFile, deleteFile } from './s3.service'

function makeFetchStub(responses: Response[]) {
  let call = 0
  return vi.fn(async () => responses[call++])
}

describe('s3.service', () => {
  it('buildKey prefixes with service/env', () => {
    const key = buildKey('uploads/foo.zip')
    expect(key).toMatch(/^qm-personal-apps\/(dev|prd)\/uploads\/foo\.zip$/)
  })

  it('uploadFile requests a presigned PUT_OBJECT url then PUTs the body', async () => {
    const fetchStub = makeFetchStub([
      new Response(JSON.stringify({ url: 'https://s3.example/presigned-put' }), { status: 200 }),
      new Response(null, { status: 200 }),
    ])

    const key = await uploadFile('uploads/foo.zip', Buffer.from('hello'), 'application/zip', fetchStub as unknown as typeof fetch)

    expect(key).toMatch(/uploads\/foo\.zip$/)
    expect(fetchStub).toHaveBeenCalledTimes(2)
    const [signCall, putCall] = fetchStub.mock.calls as any[]
    expect(signCall[0]).toContain('/sign')
    expect(JSON.parse(signCall[1].body).action).toBe('PUT_OBJECT')
    expect(putCall[0]).toBe('https://s3.example/presigned-put')
    expect(putCall[1].method).toBe('PUT')
  })

  it('downloadFile requests GET_OBJECT then fetches bytes', async () => {
    const fetchStub = makeFetchStub([
      new Response(JSON.stringify({ url: 'https://s3.example/presigned-get' }), { status: 200 }),
      new Response(Buffer.from('data'), { status: 200 }),
    ])

    const buf = await downloadFile('uploads/foo.zip', fetchStub as unknown as typeof fetch)

    expect(buf.toString()).toBe('data')
    const [signCall] = fetchStub.mock.calls as any[]
    expect(JSON.parse(signCall[1].body).action).toBe('GET_OBJECT')
  })

  it('deleteFile requests DELETE_OBJECT then DELETEs', async () => {
    const fetchStub = makeFetchStub([
      new Response(JSON.stringify({ url: 'https://s3.example/presigned-delete' }), { status: 200 }),
      new Response(null, { status: 200 }),
    ])

    await deleteFile('uploads/foo.zip', fetchStub as unknown as typeof fetch)

    const [signCall, deleteCall] = fetchStub.mock.calls as any[]
    expect(JSON.parse(signCall[1].body).action).toBe('DELETE_OBJECT')
    expect(deleteCall[1].method).toBe('DELETE')
  })
})
