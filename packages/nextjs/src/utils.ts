import fetch from 'cross-fetch'

import { NhostSession } from '@nhost/hasura-auth-js'

export const refresh = async (nhostUrl: string, refreshToken: string): Promise<NhostSession> => {
  const result = await fetch(`${nhostUrl}/v1/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken })
  })
  if (result.ok) return result.json()
  else return Promise.reject(result.statusText)
}
