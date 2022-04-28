import fetch from 'cross-fetch'

import { NhostSession } from '@nhost/core'

export const refresh = async (
  nhostUrl: string,
  refreshToken: string
): Promise<NhostSession | null> => {
  const result = await fetch(`${nhostUrl}/v1/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken })
  })
  return result.ok ? result.json() : null
}
