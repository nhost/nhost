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

    if (APPLICATION.HOST) {
      logger.info(`Running on http://${APPLICATION.HOST}:${APPLICATION.PORT}`)
    } else {
      logger.info(`Running on port ${APPLICATION.PORT}`)
    }
  })
}

start()
