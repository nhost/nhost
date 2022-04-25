import { NhostClient as VanillaClient, NhostClientConstructorParams } from '@nhost/nhost-js'

import { setClient } from './useNhostClient'

type NhostVueClientConstructorParams = Omit<NhostClientConstructorParams, 'start' | 'client'>
export class NhostClient extends VanillaClient {
  constructor(params: NhostVueClientConstructorParams) {
    super({ ...params, start: true })
    setClient(this)
  }
}
