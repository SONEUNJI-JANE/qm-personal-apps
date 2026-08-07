import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

const mockRepo = {
  create: vi.fn(),
  list: vi.fn(),
  findById: vi.fn(),
  remove: vi.fn(),
}

vi.mock('../repositories/personal-apps.repository', () => ({
  PersonalAppsRepository: vi.fn(() => mockRepo),
}))

vi.mock('../services/storage.service', () => ({
  deleteFile: vi.fn(async () => {}),
}))

vi.mock('../db/pool', () => ({ getPool: vi.fn(() => ({})) }))

const { personalAppsRoutes } = await import('./personal-apps')

const app = express()
app.use(express.json())
app.use('/api/personal-apps', personalAppsRoutes)

describe('personal-apps routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET / returns the list from the repository', async () => {
    mockRepo.list.mockResolvedValue([{ id: 1, name: 'Tool A' }])

    const res = await request(app).get('/api/personal-apps')

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([{ id: 1, name: 'Tool A' }])
  })

  it('GET /?category=TD passes the filter through', async () => {
    mockRepo.list.mockResolvedValue([])

    await request(app).get('/api/personal-apps?category=TD')

    expect(mockRepo.list).toHaveBeenCalledWith('TD')
  })

  it('POST / saves metadata for an already-uploaded file', async () => {
    mockRepo.create.mockResolvedValue({ id: 2, name: 'Tool B' })

    const res = await request(app)
      .post('/api/personal-apps')
      .send({
        name: 'Tool B',
        description: 'desc',
        category: 'QA',
        uploaderEmail: 'jade@fnfcorp.com',
        uploaderName: '김서진',
        s3Key: 'qm-personal-apps/prd/uploads/1-abc.zip',
        originalFilename: 'tool.zip',
        fileSize: 1024,
      })

    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('Tool B')
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Tool B',
        category: 'QA',
        uploader_email: 'jade@fnfcorp.com',
        uploader_name: '김서진',
        s3_key: 'qm-personal-apps/prd/uploads/1-abc.zip',
        original_filename: 'tool.zip',
        file_size: 1024,
      })
    )
  })

  it('POST / without required fields returns 400', async () => {
    const res = await request(app)
      .post('/api/personal-apps')
      .send({ name: 'Tool C', uploaderEmail: 'jade@fnfcorp.com' })

    expect(res.status).toBe(400)
  })

  it('DELETE /:id removes DB row and S3 object', async () => {
    mockRepo.findById.mockResolvedValue({ id: 4, s3_key: 'k' })
    mockRepo.remove.mockResolvedValue(undefined)

    const res = await request(app).delete('/api/personal-apps/4')

    expect(res.status).toBe(204)
    expect(mockRepo.remove).toHaveBeenCalledWith(4)
  })

  it('DELETE /:id returns 404 for unknown id', async () => {
    mockRepo.findById.mockResolvedValue(null)

    const res = await request(app).delete('/api/personal-apps/999')

    expect(res.status).toBe(404)
  })
})
