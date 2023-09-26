import { NHOST_SESSION_KEY, getNhost } from '@utils/nhost'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const nhost = await getNhost(request)
  const session = nhost.auth.getSession()

  // TODO rethink how we match protected routes
  if (!session && request.nextUrl.pathname.includes('protected')) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url))
  }

  if (session) {
    const currentTime = Math.floor(Date.now() / 1000)
    const tokenExpirationTime = nhost.auth.getDecodedAccessToken()?.exp

    if (tokenExpirationTime && currentTime > tokenExpirationTime) {
      const { session: newSession, error } = await nhost.auth.refreshSession()

      if (error) {
        // refresh token has expired or invalid
        return NextResponse.redirect(new URL('/auth/sign-in', request.url))
      }

      // overwrite the session cookie with the new session
      return NextResponse.redirect(new URL('/protected/todos', request.url), {
        headers: { 'Set-Cookie': `${NHOST_SESSION_KEY}=${btoa(JSON.stringify(newSession))}` }
      })
    }
  }

  return NextResponse.next()
}