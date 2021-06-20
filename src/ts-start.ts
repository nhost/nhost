import { APPLICATION } from '@config/index'
import { app } from './server'
import { applyMigrations } from "src/migrations"
import { applyMetadata } from "src/metadata"
import './env-vars-check'
import './enabled-deprecation-warning'

const start = async (): Promise<void> => {
  await applyMigrations()
  await applyMetadata()

  app.listen(APPLICATION.PORT, APPLICATION.HOST, () => {

    if (APPLICATION.HOST) {
      console.log(`Running on http://${APPLICATION.HOST}:${APPLICATION.PORT}`)
    } else {
      console.log(`Running on port ${APPLICATION.PORT}`)
    }
  })
}

start()
