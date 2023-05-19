import { pino } from 'pino'
import { env } from './env.mjs'

const envVars = env()

export const logger = pino({
  level: envVars.LOG_LEVEL
})
