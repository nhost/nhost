import { NextFetchEvent, NextRequest, NextResponse } from 'next/server'
import { NHOST_REFRESH_TOKEN_KEY, NHOST_ACCESS_TOKEN_KEY, NHOST_USER_KEY } from '@nhost/core'

const NHOST_BACKEND_URL = 'http://127.0.0.1:1337'
const REFRESH_URL = '/_refresh'

// ! copy-paste from hasura-auth
type Session = {
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken: string
  user?: any
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  // * Assumption: if request.page.name is null, then it's an asset e.g. favicon
  if (!request.page.name && request.nextUrl.pathname !== REFRESH_URL) return NextResponse.next()
  const oldRefreshToken = request.cookies[NHOST_REFRESH_TOKEN_KEY]
  console.log('in middleware', request.nextUrl.pathname, request.page.name, oldRefreshToken)
  if (!oldRefreshToken && request.nextUrl.pathname === REFRESH_URL) {
    return new Response('Refresh token required', { status: 401 })
  }
  console.log('PASSED!!!', request.nextUrl.pathname)
  const response =
    request.nextUrl.pathname === REFRESH_URL ? NextResponse.json('ok') : NextResponse.next()
  if (oldRefreshToken) {
    console.log('OLD TOKEN!!')
    try {
      const result = await fetch(`${NHOST_BACKEND_URL}/v1/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: oldRefreshToken })
      })
      const { refreshToken, accessToken, accessTokenExpiresIn, user }: Session = await result.json()
      // TODO set expiration (missing information from hasura-auth)
      response.cookie(NHOST_REFRESH_TOKEN_KEY, refreshToken, { httpOnly: true, sameSite: true })
      // TODO ibid.
      response.cookie(NHOST_USER_KEY, user, { httpOnly: false, sameSite: true })
      response.cookie(NHOST_ACCESS_TOKEN_KEY, accessToken, {
        httpOnly: false,
        sameSite: true,
        maxAge: accessTokenExpiresIn * 1_000
      })
      return response
    } catch (error) {
      console.warn('error in refreshing the token')
      return new Response('Invalid refresh token', { status: 401 })
    }
  }
  return response
}
