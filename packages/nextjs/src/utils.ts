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

// ! copy-paste from hasura-auth
export type Session = {
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken: string
  user?: any
}
