import { createApolloClient } from '@nhost/apollo'
import { NhostClient } from '@nhost/nhost-js'

const nhost = new NhostClient({
  backendUrl: import.meta.env.VITE_NHOST_URL ?? 'http://localhost:1337'
})

const accessToken = nhost.auth.getAccessToken()

export const client = createApolloClient({ nhost, headers:
  {
  Authorization:`Bearer ${accessToken}`,
  "content-type": "application/json",
  'x-hasura-admin-secret': import.meta.env.VITE_HASURA_ADMIN_SECRET ?? 'nhost-admin-secret'
} 
})
