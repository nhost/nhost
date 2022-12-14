import {
  BackendUrl,
  NhostAuthConstructorParams,
  NhostClient as ReactNhostClient,
  NhostProvider,
  Subdomain
} from '@nhost/react'

export * from '@nhost/react'
export * from './create-server-side-client'
export * from './get-session'
/**
 * @deprecated use `NhostProvider` instead
 */
const NhostNextProvider: typeof NhostProvider = NhostProvider

const isBrowser = typeof window !== 'undefined'

export interface NhostNextClientConstructorParams
  extends Partial<BackendUrl>,
    Partial<Subdomain>,
    Omit<
      NhostAuthConstructorParams,
      | 'url'
      | 'start'
      | 'client'
      | 'clientStorage'
      | 'clientStorageType'
      | 'clientStorageGetter'
      | 'clientStorageSetter'
    > {}

export class NhostClient extends ReactNhostClient {
  constructor(params: NhostNextClientConstructorParams) {
    super({
      ...params,
      autoSignIn: isBrowser && params.autoSignIn,
      autoRefreshToken: isBrowser && params.autoRefreshToken,
      clientStorageType: 'cookie'
    })
  }
}
