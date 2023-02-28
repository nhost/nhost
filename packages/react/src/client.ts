import {
  BackendUrl,
  NhostAuthConstructorParams,
  NhostClient as _VanillaNhostClient,
  Subdomain
} from '@nhost/nhost-js'

/** @internal */
export const VanillaNhostClient = _VanillaNhostClient

export interface NhostReactClientConstructorParams
  extends Partial<BackendUrl>,
    Partial<Subdomain>,
    Omit<NhostAuthConstructorParams, 'url' | 'start' | 'client'> {}

export class NhostClient extends VanillaNhostClient {
  constructor(params: NhostReactClientConstructorParams) {
    super({ ...params, start: false })
  }
}

// * Required for @nhost/nextjs
export { NHOST_REFRESH_TOKEN_KEY } from '@nhost/nhost-js'
export type { AuthMachine, NhostAuthConstructorParams } from '@nhost/nhost-js'
