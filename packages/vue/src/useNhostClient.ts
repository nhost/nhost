import { getCurrentInstance, inject } from 'vue'

import { NhostClient } from './client'

export const DefaultNhostClient = Symbol('default-nhost-client')

type NullableNhostClient = NhostClient | null
let currentNhostClient: NullableNhostClient

type ResolveClient = () => NullableNhostClient

export interface UseNhostClientReturn {
  resolveClient: ResolveClient
  readonly client: NhostClient
}

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

  function resolveClient() {
    const client = resolveImpl()
    if (!client) {
      throw new Error(
        `No Nhost client found. Use provideNhostClient() if you are outside of a component setup.`
      )
    }
    return client
  }

  return {
    resolveClient,
    get client() {
      return resolveClient()
    }
  }
}
