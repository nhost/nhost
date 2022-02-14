import { NextRequest, NextResponse } from 'next/server'

import { NHOST_ACCESS_TOKEN_KEY, NHOST_REFRESH_TOKEN_KEY, NHOST_USER_KEY } from '@nhost/core'

// ? move to @nhost/core?
const REFRESH_URL = '/_refresh'

// ! copy-paste from hasura-auth
type Session = {
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken: string
  user?: any
}

export const nhostNextMiddleware = (backendUrl: string) => async (request: NextRequest) => {
  // * Assumption: if request.page.name is null, then it's an asset e.g. favicon
  if (!request.page.name && request.nextUrl.pathname !== REFRESH_URL) return NextResponse.next()
  const oldRefreshToken = request.cookies[NHOST_REFRESH_TOKEN_KEY]
  console.log('in middleware', request.nextUrl.pathname)
  if (!oldRefreshToken && request.nextUrl.pathname === REFRESH_URL) {
    return new Response('Refresh token required', { status: 401 })
  }
  let response = NextResponse.next()
  try {
    const result = await fetch(`${backendUrl}/v1/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken: oldRefreshToken })
    })
    const { refreshToken, ...session }: Session = await result.json()
    if (request.nextUrl.pathname === REFRESH_URL) response = NextResponse.json(session)

    // TODO set expiration (missing information from hasura-auth)
    response.cookie(NHOST_REFRESH_TOKEN_KEY, refreshToken, { httpOnly: true, sameSite: true })
    // TODO ibid.
    response.cookie(NHOST_USER_KEY, JSON.stringify(session.user), {
      httpOnly: false,
      sameSite: true
    })
    response.cookie(NHOST_ACCESS_TOKEN_KEY, session.accessToken, {
      httpOnly: false,
      sameSite: true,
      maxAge: session.accessTokenExpiresIn * 1_000
    })
    return response
  } catch (error) {
    console.warn('error in refreshing the token')
    return new Response('Invalid refresh token', { status: 401 })
  }
}
