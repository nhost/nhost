import { useContext } from 'react'

import { NhostReactContext } from './provider'

/**
 * Use the hook `useNhostBackendUrl` to get the Nhost backend URL.
 *
 * @example
 * ```tsx
 * const nhostBackendUrl = useNhostBackendUrl()
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-nhost-backend-url
 */
export const useNhostBackendUrl = () => {
  const nhost = useContext(NhostReactContext)
  return nhost.auth.client.backendUrl.replace('/v1/auth', '')
}
