import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { routes } from './routes'
import { config } from './config'

const app = express()

app.use(helmet({ contentSecurityPolicy: false, frameguard: false }))
app.use(cors({ origin: config.CORS_ORIGIN }))
app.use(express.json())
app.use('/api', routes)

const clientDist = path.join(process.cwd(), 'client', 'dist')
app.use(express.static(clientDist))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(clientDist, 'index.html'))
})

app.use('/api', (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err)
  res.status(500).json({ success: false, error: err.message })
})

export { app }
