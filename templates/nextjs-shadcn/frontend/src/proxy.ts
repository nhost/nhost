import { type NextRequest, NextResponse } from 'next/server';
import { handleNhostProxy } from '@/lib/nhost/server';

const protectedRoutes = ['/protected'];

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next();
  const path = request.nextUrl.pathname;

  const session = await handleNhostProxy(request, response);

  const isProtectedRoute = protectedRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/signin', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.svg).*)'],
};
