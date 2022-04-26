import { computed } from 'vue'

import { useNhostClient } from './useNhostClient'

export const useNhostBackendUrl = () => {
  const { client } = useNhostClient()
  return computed(() => client.auth.client.backendUrl.replace('/v1/auth', ''))
}
