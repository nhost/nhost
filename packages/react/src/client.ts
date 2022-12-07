import {
  BackendUrl,
  NhostAuthConstructorParams,
  NhostClient as VanillaClient,
  Subdomain
} from '@nhost/nhost-js'

export * from '@nhost/nhost-js'
export interface NhostReactClientConstructorParams
  extends Partial<BackendUrl>,
    Partial<Subdomain>,
    Omit<NhostAuthConstructorParams, 'url' | 'start' | 'client'> {}

export class ReactNhostClient extends VanillaClient {
  constructor(params: NhostReactClientConstructorParams) {
    super({ ...params, start: false })
  }
}
