import type { StoredSession } from '@nhost/nhost-js/session';
import { type NextRequest, NextResponse } from 'next/server';
import { signInHref } from '@/app/signin/destination';
import {
  handleNhostProxy,
  LINK_TOKEN_PARAM,
  LINK_TYPE_PARAM,
} from '@/lib/nhost/server';

const protectedRoutes = ['/protected', '/profile'];

// Where an account marked for deletion is still allowed to go: the screen that
// undoes the mark, and sign-in, which is how it leaves.
const deletedAccountRoutes = ['/restore', '/signin'];

// Set by `deleteAccount`, cleared by `restoreAccount`. Both go through
// `metadata`, which rides along in the session, so this needs no query.
function markedDeleted(session: StoredSession | null): boolean {
  const metadata = session?.user?.metadata as
    | { deletedAt?: string }
    | null
    | undefined;

  return Boolean(metadata?.deletedAt);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  const { session, applySessionCookies, consumedLinkToken } =
    await handleNhostProxy(request);

  // The refresh token from an auth email is now in the session cookie, so
  // bounce to the same page without it: query strings leak through history,
  // bookmarks and the referer header.
  if (consumedLinkToken) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete(LINK_TOKEN_PARAM);
    clean.searchParams.delete(LINK_TYPE_PARAM);

    return applySessionCookies(NextResponse.redirect(clean));
  }

  // An account inside its grace period is not a usable account. Leaving this to
  // each page meant only `/profile` enforced it, so the rest of the app stayed
  // fully readable and writable by an account its owner had asked to delete.
  if (
    session &&
    markedDeleted(session) &&
    !deletedAccountRoutes.some(
      (route) => path === route || path.startsWith(`${route}/`),
    )
  ) {
    return applySessionCookies(
      NextResponse.redirect(new URL('/restore', request.url)),
    );
  }

  const isProtectedRoute = protectedRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );

  // This runs before the page does, so it is the only redirect a signed-out
  // visitor to a protected route ever sees. It carries where they were going,
  // which is what sends them on after they sign in rather than dropping them
  // on the default page.
  if (isProtectedRoute && !session) {
    return applySessionCookies(
      NextResponse.redirect(new URL(signInHref(path), request.url)),
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
