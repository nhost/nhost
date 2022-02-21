import { Nhost, NhostClientOptions } from './client'
import { cookieStorageGetter, cookieStorageSetter } from './storage'
const isBrowser = typeof window !== undefined

export class NhostSSR extends Nhost {
  constructor({ backendUrl }: NhostClientOptions) {
    super({
      backendUrl,
      autoLogin: isBrowser,
      autoRefreshToken: isBrowser,
      storageGetter: cookieStorageGetter,
      storageSetter: cookieStorageSetter
    })
  }
}
