import { createApolloClient } from '@nhost/apollo'
import { NhostClient } from '@nhost/nhost-js'

const nhost = new NhostClient({
  backendUrl: import.meta.env.VITE_NHOST_URL ?? 'http://localhost:1337'
})

export const client = createApolloClient({ nhost })
