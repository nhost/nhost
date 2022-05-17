import { getCurrentInstance, inject } from 'vue'

import { NhostClient } from './client'

export const DefaultNhostClient = Symbol('default-nhost-client')

type NullableNhostClient = NhostClient | null
let currentNhostClient: NullableNhostClient

interface ResolveClient {
  (): NullableNhostClient
}

interface UseNhostClientReturn {
  resolveNhostClient: ResolveClient
  readonly nhost: NhostClient
}

/**
 * Use the composable `useNhostClient` to get the Nhost JavaScript client (https://docs.nhost.io/reference/javascript).
 *
 * @example
 * ```tsx
 * const { nhost } = useNhostClient()
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-nhost-client
 */
export function useNhostClient(): UseNhostClientReturn {
  let resolveImpl: ResolveClient

  // Save current client in current closure scope
  const savedCurrentClient = currentNhostClient

  if (!getCurrentInstance()) {
    resolveImpl = () => savedCurrentClient
  } else {
    const providedNhostClient: NhostClient | null = inject(DefaultNhostClient, null)

    resolveImpl = () => {
      if (savedCurrentClient) {
        return savedCurrentClient
      } else {
        return providedNhostClient
      }
    }
  }

  function resolveNhostClient() {
    const client = resolveImpl()
    if (!client) {
      throw new Error(
        `No Nhost client found. Use provideNhostClient() if you are outside of a component setup.`
      )
    }
    return client
  }

  return {
    resolveNhostClient,
    get nhost() {
      return resolveNhostClient()
    }
  }
}
