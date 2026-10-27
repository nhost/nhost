import { type NextRequest, NextResponse } from 'next/server';
import { signInDestination, signInHref } from '@/app/signin/destination';
import {
  promoteSignInAttempt,
  recordSignInAttempt,
} from '@/app/signin/lastUsed';
import {
  handleNhostProxy,
  isPrefetch,
  LINK_TOKEN_PARAM,
  LINK_TYPE_PARAM,
} from '@/lib/nhost/server';

const protectedRoutes = ['/account'];

// The pages that sign a visitor in: the list of methods, and each method's own
// page, which `methods.ts` puts at `/auth/<method>`.
const METHOD_PAGE = /^\/auth\/[^/]+\/?$/;
const isSignInPage = (path: string): boolean =>
  path === '/signin' || METHOD_PAGE.test(path);

// What the auth service appends to `redirectTo` when a flow fails.
const authErrorParams = ['error', 'errorDescription'];

// A failed flow sends a signed-out visitor back to the page they started from,
// so the reason arrives here.
function signInRedirect(request: NextRequest): URL {
  const { pathname, search } = request.nextUrl;
  const kept = new URLSearchParams(search);
  const lifted = new URLSearchParams();
  for (const name of authErrorParams) {
    const value = kept.get(name);
    if (value !== null) {
      lifted.set(name, value);
    }
    kept.delete(name);
  }

  if (lifted.size === 0) {
    return new URL(signInHref(`${pathname}${search}`), request.url);
  }

  const rest = kept.size > 0 ? `?${kept}` : '';
  return new URL(`${signInHref(`${pathname}${rest}`)}&${lifted}`, request.url);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  const { session, pendingReset, applySessionCookies } =
    await handleNhostProxy(request);

  // Every response goes through here.
  const respond = (response: NextResponse): NextResponse => {
    applySessionCookies(response);
    if (session) {
      return promoteSignInAttempt(request, response);
    }
    if (METHOD_PAGE.test(path) && !isPrefetch(request)) {
      return recordSignInAttempt(response, path.replace(/\/$/, ''));
    }
    return response;
  };

  // A refresh token has no business staying in the address bar: query strings
  // leak through history, bookmarks and the referer header. Stripped whether
  // or not it was redeemed: a token the proxy declined is still live.
  if (request.nextUrl.searchParams.has(LINK_TOKEN_PARAM)) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete(LINK_TOKEN_PARAM);
    clean.searchParams.delete(LINK_TYPE_PARAM);

    return respond(NextResponse.redirect(clean));
  }

  // A reset link signed this visitor in so they could choose a new password,
  // not so they could use the account with the old one forgotten.
  if (pendingReset) {
    const resetPage = signInDestination(pendingReset);
    if (path !== resetPage) {
      return respond(NextResponse.redirect(new URL(resetPage, request.url)));
    }
  }

  const isProtectedRoute = protectedRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );

  // This runs before the page does, so it is the only redirect a signed-out
  // visitor to a protected route ever sees.
  if (isProtectedRoute && !session) {
    return respond(NextResponse.redirect(signInRedirect(request)));
  }

  // Someone already signed in has nothing to do on a sign-in page, so they go
  // on to where it would have sent them.
  if (isSignInPage(path) && session) {
    const destination = signInDestination(
      request.nextUrl.searchParams.get('next') ?? undefined,
    );

    return respond(NextResponse.redirect(new URL(destination, request.url)));
  }

  // `{ request }` forwards the cookies `handleNhostProxy` refreshed, so Server
  // Components on this request render with the new session instead of the one
  // the browser sent.
  return respond(NextResponse.next({ request }));
}

// The second entry runs the proxy on the paths the first leaves out whenever a
// link token is on them, since a crafted redirectTo can point an auth email at
// any path on this origin.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    { source: '/:path*', has: [{ type: 'query', key: 'refreshToken' }] },
  ],
};
