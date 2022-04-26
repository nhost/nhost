import { NhostClient, NhostClientConstructorParams } from './core'

const createClient = (config: NhostClientConstructorParams) => new NhostClient(config)

export * from './clients'
export * from './core'
export { createClient }
