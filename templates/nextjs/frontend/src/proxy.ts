import { type NextRequest, NextResponse } from 'next/server';
import { signInHref } from '@/app/signin/destination';
import {
  handleNhostProxy,
  LINK_TOKEN_PARAM,
  LINK_TYPE_PARAM,
} from '@/lib/nhost/server';

const protectedRoutes = ['/protected'];

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  const { session, applySessionCookies } = await handleNhostProxy(request);

  // A refresh token has no business staying in the address bar: query strings
  // leak through history, bookmarks and the referer header. Stripped whenever
  // one is there, not only when it was redeemed - a token the proxy declined
  // is a *live* credential sitting in the URL until it expires.
  if (request.nextUrl.searchParams.has(LINK_TOKEN_PARAM)) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete(LINK_TOKEN_PARAM);
    clean.searchParams.delete(LINK_TYPE_PARAM);

    return applySessionCookies(NextResponse.redirect(clean));
  }

  const isProtectedRoute = protectedRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );

  // This runs before the page does, so it is the only redirect a signed-out
  // visitor to a protected route ever sees. It carries where they were going,
  // which is what sends them on after they sign in rather than dropping them
  // on the default page. It reads the cookie without verifying it, so each
  // protected page still checks the visitor with `getVerifiedUser`.
  if (isProtectedRoute && !session) {
    return applySessionCookies(
      NextResponse.redirect(
        new URL(signInHref(`${path}${request.nextUrl.search}`), request.url),
      ),
    );
  }

  // `{ request }` forwards the cookies `handleNhostProxy` refreshed, so Server
  // Components on this request render with the new session instead of the one
  // the browser sent.
  return applySessionCookies(NextResponse.next({ request }));
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
