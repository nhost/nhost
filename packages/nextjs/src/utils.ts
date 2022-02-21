import { NhostSession } from '@nhost/client'

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
  if (result.status >= 400) return null
  return await result.json()
}
