import { NextFetchEvent, NextRequest, NextResponse } from 'next/server'
const COOKIE_NAME = 'token'
const NHOST_BACKEND_URL = 'http://127.0.0.1:1337'

// ! copy-paste from hasura-auth
type Session = {
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken: string
  user?: any
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  // * assumption: if request.page.name is null, then it's an asset e.g. favicon
  if (!request.page.name) return NextResponse.next()
  const oldRefreshToken = request.cookies[COOKIE_NAME]
  console.log('in middleware', request.nextUrl.pathname, request.page.name)
  if (oldRefreshToken) {
    try {
      //   const {
      //     data: { refreshToken, ...rest }
      //   } = await axios.post<Session>(`${NHOST_BACKEND_URL}/v1/auth/token`, {
      //     refreshToken: oldRefreshToken
      //   })
      const result = await fetch(`${NHOST_BACKEND_URL}/v1/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: oldRefreshToken })
      })
      const { refreshToken, ...rest }: Session = await result.json()
      let response: NextResponse
      if (request.nextUrl.pathname === '/_refresh') {
        response = NextResponse.json(rest)
      } else {
        console.log('AUTH - set response headers')
        response = NextResponse.next()
        // TODO do NOT send the JWT back to the client, but store it somewhere for later
        response.headers.set('authorization', `Bearer ${rest.accessToken}`)
      }
      response.cookie(COOKIE_NAME, refreshToken, { httpOnly: true, sameSite: true })
      console.log('HERE', response.cookies)
      return response
    } catch (error) {
      console.warn('error in refreshing the token')
      return NextResponse.json({ token: 'error' })
    }
  } else {
    console.log('NOPE')
    const response = NextResponse.next()
    response.cookie(COOKIE_NAME, '76cec059-53ff-4135-ad65-4f86b58d3786', {
      httpOnly: true,
      sameSite: true
    })

    return response
  }
}
