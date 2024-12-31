import { AuthErrorPayload, NhostClient, NhostSession } from '@nhost/nhost-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
export const NHOST_SESSION_KEY = 'nhostSession'

export const getNhost = async (request?: NextRequest) => {
  const $cookies = request?.cookies || cookies()

  const nhost = new NhostClient({
    subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || 'local',
    region: process.env.NEXT_PUBLIC_NHOST_REGION,
    start: false,
    autoRefreshToken: false
  })

  const sessionCookieValue = $cookies.get(NHOST_SESSION_KEY)?.value || ''
  const initialSession: NhostSession = JSON.parse(atob(sessionCookieValue) || 'null')

  await nhost.auth.initWithSession({ session: initialSession })
  return nhost
}

export const manageAuthSession = async (
  request: NextRequest,
  onError?: (error: AuthErrorPayload) => NextResponse
) => {
  const nhost = await getNhost(request)
  const session = nhost.auth.getSession()

  const url = new URL(request.url)
  const refreshToken = url.searchParams.get('refreshToken') || undefined

  const currentTime = Math.floor(Date.now() / 1000)
  const tokenExpirationTime = nhost.auth.getDecodedAccessToken()?.exp
  const accessTokenExpired = session && tokenExpirationTime && currentTime > tokenExpirationTime

  if (accessTokenExpired || refreshToken) {
    const { session: newSession, error } = await nhost.auth.refreshSession(refreshToken)

    if (error) {
      onError?.(error)
    }

    // remove the refreshToken from the url
    url.searchParams.delete('refreshToken')

    // overwrite the session cookie with the new session
    return NextResponse.redirect(url, {
      headers: {
        'Set-Cookie': `${NHOST_SESSION_KEY}=${btoa(JSON.stringify(newSession))}; Path=/`
      }
    })
  }
}
