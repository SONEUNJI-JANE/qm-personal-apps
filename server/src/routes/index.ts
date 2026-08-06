import { Router } from 'express'
import { healthRoutes } from './health'
import { personalAppsRoutes } from './personal-apps'

const router = Router()
router.use('/health', healthRoutes)
router.use('/personal-apps', personalAppsRoutes)

export { router as routes }
