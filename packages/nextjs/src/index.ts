import {
  BackendUrl,
  NhostAuthConstructorParams,
  NhostClient as VanillaNhostClient,
  Subdomain
} from '@nhost/nhost-js'

export * from './create-server-side-client'
export * from './get-session'
export type { NhostSession } from '@nhost/core'
export * from '@nhost/react'
export { NhostReactProvider as NhostNextProvider } from '@nhost/react'

const isBrowser = typeof window !== 'undefined'

export interface NhostNextClientConstructorParams
  extends Partial<BackendUrl>,
    Partial<Subdomain>,
    Omit<
      NhostAuthConstructorParams,
      'url' | 'start' | 'client' | 'clientStorage' | 'clientStorageType'
    > {}

export class NhostClient extends VanillaNhostClient {
  constructor(params: NhostNextClientConstructorParams) {
    super({
      ...params,
      start: false,
      autoSignIn: isBrowser && params.autoSignIn,
      autoRefreshToken: isBrowser && params.autoRefreshToken,
      clientStorageType: 'cookie'
    })
  }
}
