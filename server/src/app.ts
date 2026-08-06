import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { routes } from './routes'
import { config } from './config'

const app = express()

app.use(helmet())
app.use(cors({ origin: config.CORS_ORIGIN }))
app.use(express.json())
app.use('/api', routes)

export { app }
