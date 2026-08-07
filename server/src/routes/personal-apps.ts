import { Router, Request, Response, NextFunction } from 'express'
import { PersonalAppsRepository } from '../repositories/personal-apps.repository'
import { getPool } from '../db/pool'
import { deleteFile } from '../services/storage.service'

const router = Router()
const repo = new PersonalAppsRepository(getPool())

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined
    const apps = await repo.list(category)
    res.json({ success: true, data: apps })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, uploaderEmail, s3Key, originalFilename, fileSize } = req.body
    if (!name || !uploaderEmail || !s3Key || !originalFilename || typeof fileSize !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'name, uploaderEmail, s3Key, originalFilename, fileSize are required',
      })
    }

    const created = await repo.create({
      name,
      description: req.body.description || null,
      category: req.body.category || null,
      s3_key: s3Key,
      original_filename: originalFilename,
      file_size: fileSize,
      uploader_email: uploaderEmail,
      uploader_name: req.body.uploaderName || null,
    })

    res.status(201).json({ success: true, data: created })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const app = await repo.findById(Number(req.params.id))
    if (!app) {
      return res.status(404).json({ success: false, error: 'App not found' })
    }

    await repo.remove(app.id)

    try {
      await deleteFile(app.s3_key)
    } catch (storageError) {
      console.error(`스토리지 삭제 실패 (DB는 이미 삭제됨), key=${app.s3_key}:`, storageError)
    }

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export { router as personalAppsRoutes }
