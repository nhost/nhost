import { manageAuthSession } from '@utils/nhost'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  return manageAuthSession(request, (error) =>
    NextResponse.redirect(new URL('/auth/sign-in', request.url))
  )
}
