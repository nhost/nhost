import { manageAuthSession } from '@utils/nhost'

// eslint-disable-next-line @next/next/no-server-import-in-page
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  return manageAuthSession(request, () =>
    NextResponse.redirect(new URL('/auth/sign-in', request.url))
  )
}
