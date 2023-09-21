import { NHOST_SESSION_KEY, getNhost } from '@utils/nhost'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const nhost = await getNhost()

  const url = new URL(request.url)
  const refreshToken = url.searchParams.get('refreshToken')

  if (refreshToken) {
    const { session } = await nhost.auth.refreshSession(refreshToken)

    if (session) {
      return NextResponse.redirect(new URL('/protected/todos', request.url), {
        headers: { 'Set-Cookie': `${NHOST_SESSION_KEY}=${btoa(JSON.stringify(session))}` }
      })
    }
  }

  return NextResponse.redirect(new URL('/sign-in', request.url))
}
