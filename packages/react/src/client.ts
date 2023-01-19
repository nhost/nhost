import {
  AuthMachine,
  NhostAuthConstructorParams,
  NhostClient as _VanillaNhostClient,
  NhostClientConstructorParams as VanillaNhostClientConstructorParams,
  NHOST_REFRESH_TOKEN_KEY
} from '@nhost/nhost-js'

// * Required for @nhost/nextjs
export type { NhostAuthConstructorParams, AuthMachine }
export { NHOST_REFRESH_TOKEN_KEY }

/** @internal */
export const VanillaNhostClient = _VanillaNhostClient

export interface NhostReactClientConstructorParams
  extends Omit<VanillaNhostClientConstructorParams, 'start' | 'client'> {}

export class NhostClient extends VanillaNhostClient {
  constructor(params: NhostReactClientConstructorParams) {
    super({ ...params, start: false })
  }
}
