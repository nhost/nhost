import { type NextRequest, NextResponse } from 'next/server';
import { signInHref } from '@/app/signin/destination';
import { LINK_CODE_PARAM } from '@/lib/nhost/pkce';
import { handleNhostProxy } from '@/lib/nhost/server';

const protectedRoutes = ['/protected', '/profile'];

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  const { session, applySessionCookies, clearLinkParams } =
    await handleNhostProxy(request);

  // Whatever became of the code from an auth email, it does not stay in the
  // URL: query strings leak through history, bookmarks and the referer header.
  if (clearLinkParams) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete(LINK_CODE_PARAM);
    clean.searchParams.delete('type');

    return applySessionCookies(NextResponse.redirect(clean));
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

// Every term is anchored. Unanchored they match anywhere in the path, so a
// perfectly ordinary route like `/api-docs` or `/iconasvg` would skip the
// proxy entirely: no session refresh and no route gating, on a page that looks
// like every other one.
export const config = {
  matcher: [
    '/((?!api(?:/|$)|_next/static/|_next/image(?:/|$)|favicon\\.ico$|icon\\.svg$).*)',
  ],
};
