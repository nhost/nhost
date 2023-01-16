import { useContext } from 'react'

import { NhostReactContext } from './provider'

/**
 * @deprecated Nhost services can now be split to subdomains to improve performance with CDN. Use `nhost.auth.url` or `nhost.storage.url` instead.
 * Use the hook `useNhostBackendUrl` to get the Nhost backend URL.
 *
 * @example
 * ```tsx
 * const nhostBackendUrl = useNhostBackendUrl()
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-nhost-backend-url
 */
export const useNhostBackendUrl = (): string => {
  const nhost = useContext(NhostReactContext)
  return nhost.auth.client.backendUrl.replace('/v1/auth', '')
}
