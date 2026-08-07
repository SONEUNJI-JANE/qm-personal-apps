import { describe, it, expect, vi } from 'vitest'
import { deleteFile } from './storage.service'

describe('storage.service', () => {
  it('deleteFile DELETEs the object', async () => {
    const fetchStub = vi.fn(async () => new Response(null, { status: 200 }))

    await deleteFile('qm-personal-apps/prd/uploads/foo.zip', fetchStub as unknown as typeof fetch)

    expect(fetchStub).toHaveBeenCalledTimes(1)
    const [url, init] = fetchStub.mock.calls[0] as any[]
    expect(url).toContain('/storage/v1/object/')
    expect(init.method).toBe('DELETE')
    expect(init.headers.apikey).toBeDefined()
  })

  it('deleteFile throws with the status on failure', async () => {
    const fetchStub = vi.fn(async () => new Response(null, { status: 403 }))

    await expect(
      deleteFile('qm-personal-apps/prd/uploads/foo.zip', fetchStub as unknown as typeof fetch)
    ).rejects.toThrow('삭제 실패: 403')
  })
})
