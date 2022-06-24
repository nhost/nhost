import { NhostClientConstructorParams } from './utils/types'
import { NhostClient } from './core'

const createClient = (config: NhostClientConstructorParams) => new NhostClient(config)

export * from './clients'
export * from './core'
export * from './utils/types'
export { createClient }
