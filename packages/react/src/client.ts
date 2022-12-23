import {
  BackendUrl,
  NhostAuthConstructorParams,
  NhostClient as VanillaNhostClient,
  Subdomain
} from '@nhost/nhost-js'

export * from '@nhost/nhost-js'
export { VanillaNhostClient }

export interface NhostReactClientConstructorParams
  extends Partial<BackendUrl>,
    Partial<Subdomain>,
    Omit<NhostAuthConstructorParams, 'url' | 'start' | 'client'> {}

export class NhostClient extends VanillaNhostClient {
  constructor(params: NhostReactClientConstructorParams) {
    super({ ...params, start: false })
  }
}
