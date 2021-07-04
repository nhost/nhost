import { applyMigrations } from '@/migrations'
import { applyMetadata } from '@/metadata'
import './env-vars-check'
import './enabled-deprecation-warning'
import logger from './logger'

const codegenStart = async (): Promise<void> => {
  await applyMigrations()
  await applyMetadata()
  logger.info('Running in codegen mode')
}

codegenStart()
