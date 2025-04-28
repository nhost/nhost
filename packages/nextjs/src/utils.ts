import { NhostClient, NhostSession } from '@nhost/react'
import fetchPonyfill from 'fetch-ponyfill'
import Cookies from 'js-cookie'

let fetch: any

if (typeof fetch === 'undefined') {
  fetch = fetchPonyfill().fetch
}

export const refresh = async (nhostUrl: string, refreshToken: string): Promise<NhostSession> => {
  const result = await fetch(`${nhostUrl}/v1/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken })
  })
  if (result.ok) {
    return result.json()
  }
  return Promise.reject(result.statusText)
}

export const NHOST_SESSION_KEY = 'nhostSession'

export const setNhostSessionInCookie = (param: NhostClient | NhostSession | null) => {
  const session = param && 'auth' in param ? param.auth.getSession() : param
  if (!session) {
    Cookies.remove(NHOST_SESSION_KEY)
    return
  }
  const { refreshToken, ...rest } = session
  const expires = new Date()
  // * Expire the cookie 60 seconds before the token expires
  expires.setSeconds(expires.getSeconds() + session.accessTokenExpiresIn - 60)
  Cookies.set(NHOST_SESSION_KEY, JSON.stringify(rest), {
    sameSite: 'strict',
    expires
  })
}
