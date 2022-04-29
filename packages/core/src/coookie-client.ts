import { AuthClient, NhostClientOptions } from './client'
import { cookieStorageGetter, cookieStorageSetter } from './storage'
const isBrowser = typeof window !== 'undefined'

export class AuthCookieClient extends AuthClient {
  constructor({
    ...options
  }: Omit<NhostClientOptions, 'clientStorageGetter' | 'clientStorageSetter'>) {
    super({
      ...options,
      autoSignIn: isBrowser && options.autoSignIn,
      autoRefreshToken: isBrowser && options.autoRefreshToken,
      clientStorageGetter: cookieStorageGetter,
      clientStorageSetter: cookieStorageSetter
    })
  }
}

/** @deprecated Alias for {@link AuthCookieClient} */
export const AuthClientSSR = AuthCookieClient
