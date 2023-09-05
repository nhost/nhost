import { getNhost } from '@utils/nhost'
// eslint-disable-next-line @next/next/no-server-import-in-page
import { NextRequest, NextResponse } from 'next/server'

export const config = {
  matcher: '/protected'
}

export async function middleware(request: NextRequest) {
  const nhost = await getNhost(request)
  const session = nhost.auth.getSession()

  if (!session) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }
}
