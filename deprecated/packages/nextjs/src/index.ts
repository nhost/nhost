import {
  NhostClient as ReactNhostClient,
  NhostProvider,
  NhostReactClientConstructorParams
} from '@nhost/react'
import { setNhostSessionInCookie } from './utils'

export * from '@nhost/react'
export * from './create-server-side-client'
export * from './get-session'
/**
 * @deprecated use `NhostProvider` instead
 */
export const NhostNextProvider: typeof NhostProvider = NhostProvider

const isBrowser = typeof window !== 'undefined'

export interface NhostNextClientConstructorParams
  extends Omit<
    NhostReactClientConstructorParams,
    'clientStorage' | 'clientStorageType' | 'clientStorageGetter' | 'clientStorageSetter'
  > {}

export class NhostClient extends ReactNhostClient {
  constructor(params: NhostNextClientConstructorParams) {
    super({
      ...params,
      autoSignIn: isBrowser && params.autoSignIn,
      autoRefreshToken: isBrowser && params.autoRefreshToken,
      clientStorageType: 'cookie'
    })

    this.auth.onAuthStateChanged(() => {
      setNhostSessionInCookie(this)
    })
    this.auth.onTokenChanged(setNhostSessionInCookie)
  }
}
