import {
  BackendUrl,
  NhostAuthConstructorParams,
  NhostClient as VanillaNhostClient,
  Subdomain
} from '@nhost/nhost-js'
import { NhostProvider } from '@nhost/react'

export type { NhostSession } from '@nhost/nhost-js'
export * from '@nhost/react'
export { NhostProvider } from '@nhost/react'
export * from './create-server-side-client'
export * from './get-session'

/**
 * @deprecated use `NhostProvider` instead
 */
export const NhostNextProvider: typeof NhostProvider = NhostProvider

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
