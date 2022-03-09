import { AuthClient, NhostClientOptions } from './client'
import { cookieStorageGetter, cookieStorageSetter } from './storage'
const isBrowser = typeof window !== undefined

export class AuthClientSSR extends AuthClient {
  constructor({ backendUrl }: NhostClientOptions) {
    super({
      backendUrl,
      autoSignIn: isBrowser,
      autoRefreshToken: isBrowser,
      storageGetter: cookieStorageGetter,
      storageSetter: cookieStorageSetter
    })
  }
}
