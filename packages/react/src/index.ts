import { NhostClient as VanillaClient, NhostClientConstructorParams } from '@nhost/nhost-js'

export * from './hooks'
export * from './provider'

type NhostReactClientConstructorParams = Omit<NhostClientConstructorParams, 'start' | 'client'>

export class NhostClient extends VanillaClient {
  constructor(params: NhostReactClientConstructorParams) {
    super({ ...params, start: false })
  }
}
