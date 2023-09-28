import { NHOST_SESSION_KEY, getNhost } from '@utils/nhost'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
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
      // refresh token has expired or invalid
      return NextResponse.redirect(new URL('/auth/sign-in', request.url))
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

  return NextResponse.next()
}
