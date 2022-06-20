import { Subdomain } from '@nhost/nhost-js'
import { BackendUrl } from '@nhost/nhost-js'
import { NhostAuthConstructorParams, NhostClient as VanillaClient } from '@nhost/nhost-js'

export interface NhostReactClientConstructorParams
  extends Partial<BackendUrl>,
    Partial<Subdomain>,
    Omit<NhostAuthConstructorParams, 'url' | 'start' | 'client'> {}

export class NhostClient extends VanillaClient {
  constructor(params: NhostReactClientConstructorParams) {
    super({ ...params, start: false })
  }
}
