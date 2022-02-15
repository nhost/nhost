import { Session } from './types'

export const refresh = async (baseUrl: string, refreshToken: string): Promise<Session> => {
  const result = await fetch(`${baseUrl}/v1/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken })
  })
  return await result.json()
}
