import { useContext } from 'react'

import { NhostClient } from '@nhost/nhost-js'

import { NhostReactContext } from './provider'

/**
 * Use the hook `useNhostClient` to get the Nhost JavaScript client (https://docs.nhost.io/reference/javascript).
 *
 * @example
 * ```tsx
 * const nhost = useNhostClient()
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-nhost-client
 */
export const useNhostClient = (): NhostClient => {
  const nhost = useContext(NhostReactContext)
  return nhost
}
