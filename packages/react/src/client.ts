import {
  AuthMachine,
  BackendUrl,
  NhostAuthConstructorParams,
  NhostClient as _VanillaNhostClient,
  NhostSession,
  NHOST_REFRESH_TOKEN_KEY,
  Subdomain
} from '@nhost/nhost-js'

export type { NhostSession, NhostAuthConstructorParams, AuthMachine, Subdomain, BackendUrl }
export { NHOST_REFRESH_TOKEN_KEY }

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
