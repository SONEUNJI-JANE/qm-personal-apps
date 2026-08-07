import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { randomUUID } from 'crypto'
import { extname } from 'path'
import { PersonalAppsRepository } from '../repositories/personal-apps.repository'
import { getPool } from '../db/pool'
import { uploadFile, downloadFile, deleteFile } from '../services/storage.service'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })
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

router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' })
    }
    if (!req.body.name || !req.body.uploaderEmail) {
      return res.status(400).json({ success: false, error: 'name and uploaderEmail are required' })
    }

    const ext = extname(req.file.originalname)
    const safeExt = /^\.[a-zA-Z0-9]{1,10}$/.test(ext) ? ext : ''
    const s3Key = await uploadFile(
      `uploads/${Date.now()}-${randomUUID()}${safeExt}`,
      req.file.buffer,
      req.file.mimetype
    )

    const created = await repo.create({
      name: req.body.name,
      description: req.body.description ?? null,
      category: req.body.category ?? null,
      s3_key: s3Key,
      original_filename: req.file.originalname,
      file_size: req.file.size,
      uploader_email: req.body.uploaderEmail,
    })

    res.status(201).json({ success: true, data: created })
  } catch (error) {
    next(error)
  }
})

router.get('/:id/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const app = await repo.findById(Number(req.params.id))
    if (!app) {
      return res.status(404).json({ success: false, error: 'App not found' })
    }

    const buffer = await downloadFile(app.s3_key)
    const encodedName = encodeURIComponent(app.original_filename)
    res.setHeader('Content-Disposition', `attachment; filename="download"; filename*=UTF-8''${encodedName}`)
    res.send(buffer)
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
