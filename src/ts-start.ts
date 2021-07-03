import { APPLICATION } from '@config/index'
import { app } from './server'
import { applyMigrations } from '@/migrations'
import { applyMetadata } from '@/metadata'
import './env-vars-check'
import './enabled-deprecation-warning'
import logger from './logger'

const start = async (): Promise<void> => {
  await applyMigrations()
  await applyMetadata()

  app.listen(APPLICATION.PORT, APPLICATION.HOST, () => {
    logger.info('test logger')
    if (APPLICATION.HOST) {
      logger.info(`2 Running on http://${APPLICATION.HOST}:${APPLICATION.PORT}`)
    } else {
      logger.info(`2 Running on port ${APPLICATION.PORT}`)
    }
  })
}

start()
