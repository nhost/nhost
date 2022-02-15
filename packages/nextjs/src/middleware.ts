import type { NextRequest } from 'next/server'

import { NHOST_NEXT_REFRESH_KEY, NHOST_REFRESH_TOKEN_KEY } from '@nhost/core'

import { refresh } from './utils'

// ? move to @nhost/core?
const REFRESH_URL = '/_refresh'
// TODO remove this: with no http-only, the client can set the cookie on its own, so there is no need of this proxy anymore
export const nhostNextMiddleware = (backendUrl: string) => async (request: NextRequest) => {
  // * 'next/server' is only available when running this code on server-side.
  // * To import it in the module scope make NextJS dev/build fail
  const { NextResponse } = await import('next/server')
  // * Assumption: if request.page.name is null, then it's an asset e.g. favicon
  // if (!request.page.name && request.nextUrl.pathname !== REFRESH_URL) return NextResponse.next()
  console.log('in middleware', request.nextUrl.pathname)
  if (request.nextUrl.pathname === REFRESH_URL) {
    const oldRefreshToken = request.cookies[NHOST_REFRESH_TOKEN_KEY]
    if (!oldRefreshToken && request.nextUrl.pathname === REFRESH_URL) {
      return new Response('Refresh token required', { status: 401 })
    }
    try {
      const session = await refresh(backendUrl, oldRefreshToken)
      const response = NextResponse.json(session)
      response.cookie(NHOST_REFRESH_TOKEN_KEY, session.refreshToken, { sameSite: true })
      response.cookie(
        NHOST_NEXT_REFRESH_KEY,
        new Date(Date.now() + session.accessTokenExpiresIn * 1_000).toISOString()
      )
      return response
    } catch (error) {
      console.warn('error in refreshing the token')
      return new Response('Invalid refresh token', { status: 401 })
    }
  }
  // TODO set expiration (missing information from hasura-auth)
  // TODO ibid.
  return NextResponse.next()
}
