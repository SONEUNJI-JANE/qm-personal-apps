import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getPool, closePool } from '../db/pool'
import { PersonalAppsRepository } from './personal-apps.repository'
import { SCHEMA_SQL } from '../db/schema'

describe('PersonalAppsRepository', () => {
  const repo = new PersonalAppsRepository(getPool())

  beforeAll(async () => {
    await getPool().query(SCHEMA_SQL)
  })

  beforeEach(async () => {
    await getPool().query('delete from personal_apps')
  })

  afterAll(async () => {
    await getPool().query('drop table if exists personal_apps')
    await closePool()
  })

  it('creates and lists an app', async () => {
    await repo.create({
      name: '패턴 요청 툴',
      description: '자동 회신용',
      category: '패턴툴',
      s3_key: 'qm-personal-apps/dev/uploads/1-tool.zip',
      original_filename: 'tool.zip',
      file_size: 1024,
      uploader_email: 'jade@fnfcorp.com',
    })

    const apps = await repo.list()
    expect(apps).toHaveLength(1)
    expect(apps[0].name).toBe('패턴 요청 툴')
    expect(apps[0].category).toBe('패턴툴')
  })

  it('filters by category', async () => {
    await repo.create({
      name: 'A', description: null, category: 'TD',
      s3_key: 'k1', original_filename: 'a.zip', file_size: 10, uploader_email: 'a@fnfcorp.com',
    })
    await repo.create({
      name: 'B', description: null, category: 'QA',
      s3_key: 'k2', original_filename: 'b.zip', file_size: 10, uploader_email: 'b@fnfcorp.com',
    })

    const tdOnly = await repo.list('TD')
    expect(tdOnly).toHaveLength(1)
    expect(tdOnly[0].name).toBe('A')
  })

  it('removes an app by id', async () => {
    const created = await repo.create({
      name: 'C', description: null, category: null,
      s3_key: 'k3', original_filename: 'c.zip', file_size: 10, uploader_email: 'c@fnfcorp.com',
    })

    await repo.remove(created.id)

    const found = await repo.findById(created.id)
    expect(found).toBeNull()
  })
})
