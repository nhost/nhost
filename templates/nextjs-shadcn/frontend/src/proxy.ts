import { type NextRequest, NextResponse } from 'next/server';
import { handleNhostProxy } from '@/lib/nhost/server';

const protectedRoutes = ['/protected'];

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  const { session, applySessionCookies } = await handleNhostProxy(request);

  const isProtectedRoute = protectedRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );

  if (isProtectedRoute && !session) {
    return applySessionCookies(
      NextResponse.redirect(new URL('/signin', request.url)),
    );
  }

  // `{ request }` forwards the cookies `handleNhostProxy` refreshed, so Server
  // Components on this request render with the new session instead of the one
  // the browser sent.
  return applySessionCookies(NextResponse.next({ request }));
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
