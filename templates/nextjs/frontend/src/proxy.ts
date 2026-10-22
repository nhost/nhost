import { type NextRequest, NextResponse } from 'next/server';
import { signInDestination, signInHref } from '@/app/signin/destination';
import {
  handleNhostProxy,
  LINK_TOKEN_PARAM,
  LINK_TYPE_PARAM,
} from '@/lib/nhost/server';

const protectedRoutes = ['/account'];

// The pages that sign a visitor in: the list of methods, and each method's own
// page, which `methods.ts` puts at `/auth/<method>`. Only that one segment:
// deeper pages such as the password reset need the session they arrive with.
const isSignInPage = (path: string): boolean =>
  path === '/signin' || /^\/auth\/[^/]+\/?$/.test(path);

// What the auth service appends to `redirectTo` when a flow fails.
const authErrorParams = ['error', 'errorDescription'];

// A failed flow sends a signed-out visitor back to the page they started from,
// so the reason arrives here. Left inside `next` it would show
// nowhere, and come back after they signed in; on the sign-in URL it is shown
// right where they choose again.
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

  // A reset link signed this visitor in so they could choose a new password,
  // not so they could use the account with the old one forgotten. Until the
  // password is saved, every page but the reset page sends them back to it.
  // The cookie is the visitor's own to edit, so it is held to a path here.
  if (pendingReset) {
    const resetPage = signInDestination(pendingReset);
    if (path !== resetPage) {
      return applySessionCookies(
        NextResponse.redirect(new URL(resetPage, request.url)),
      );
    }
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
    return applySessionCookies(NextResponse.redirect(signInRedirect(request)));
  }

  // Someone already signed in has nothing to do on a sign-in page, so they go
  // on to where it would have sent them. Like the check above it reads the
  // cookie unverified, which is enough to choose a redirect.
  if (isSignInPage(path) && session) {
    const destination = signInDestination(
      request.nextUrl.searchParams.get('next') ?? undefined,
    );

    return applySessionCookies(
      NextResponse.redirect(new URL(destination, request.url)),
    );
  }

  // `{ request }` forwards the cookies `handleNhostProxy` refreshed, so Server
  // Components on this request render with the new session instead of the one
  // the browser sent.
  return applySessionCookies(NextResponse.next({ request }));
}

// The second entry runs the proxy on the paths the first leaves out whenever
// a link token is on them, since a crafted redirectTo can point an auth email
// at any path on this origin. It has to be the literal: Next reads this config
// without running the module, so `LINK_TOKEN_PARAM` cannot be used here.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    { source: '/:path*', has: [{ type: 'query', key: 'refreshToken' }] },
  ],
};
