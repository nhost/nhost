import { AuthClient, NhostClientOptions } from './client'
const isBrowser = typeof window !== 'undefined'

/** @deprecated Not in use anymore. Use `clientStorageType: 'cookie'` instead */
export class AuthCookieClient extends AuthClient {
  constructor({
    ...options
  }: Omit<
    NhostClientOptions,
    'clientStorageGetter' | 'clientStorageSetter' | 'clientStorage' | 'clientStorageType'
  >) {
    super({
      ...options,
      autoSignIn: isBrowser && options.autoSignIn,
      autoRefreshToken: isBrowser && options.autoRefreshToken,
      clientStorageType: 'cookie'
    })
  }
}

/** @deprecated Alias for {@link AuthCookieClient} */
export const AuthClientSSR = AuthCookieClient
