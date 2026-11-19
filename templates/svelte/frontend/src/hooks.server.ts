import { redirect } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { warnAboutDefaults } from '#lib/nhost/env.server.ts';
import {
  handleNhostRequest,
  isApiRoute,
  LINK_TOKEN_PARAM,
  LINK_TYPE_PARAM,
} from '#lib/nhost/server.ts';
import { signInDestination, signInHref } from '#routes/signin/destination.ts';
import {
  promoteSignInAttempt,
  recordSignInAttempt,
} from '#routes/signin/lastUsed.ts';
import { dev } from '$app/env';

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
function signInRedirect({ pathname, search }: URL): string {
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
    return signInHref(`${pathname}${search}`);
  }

  const rest = kept.size > 0 ? `?${kept}` : '';
  return `${signInHref(`${pathname}${rest}`)}&${lifted}`;
}

// SvelteKit writes the Content-Security-Policy itself, from vite.config.ts.
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
};

function withSecurityHeaders(response: Response): Response {
  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

export const init: ServerInit = () => {
  if (!dev) {
    warnAboutDefaults();
  }
};

export const handle: Handle = async ({ event, resolve }) => {
  const { url } = event;
  const path = url.pathname;

  const { session, pendingReset } = await handleNhostRequest(event);

  // A remote function checks the session itself, and its `url` is the page
  // that called it, not a page to send anywhere.
  if (event.isRemoteRequest) {
    return withSecurityHeaders(await resolve(event));
  }

  // A refresh token has no business staying in the address bar: query strings
  // leak through history, bookmarks and the referer header. Stripped whether
  // or not it was redeemed, and on any path, since a crafted redirectTo can
  // point an auth email at any path on this origin.
  if (url.searchParams.has(LINK_TOKEN_PARAM)) {
    const clean = new URLSearchParams(url.search);
    clean.delete(LINK_TOKEN_PARAM);
    clean.delete(LINK_TYPE_PARAM);

    redirect(307, clean.size > 0 ? `${path}?${clean}` : path);
  }

  // API routes are their own gatekeepers.
  if (!isApiRoute(path)) {
    if (session) {
      promoteSignInAttempt(event.cookies);
    } else if (METHOD_PAGE.test(path)) {
      recordSignInAttempt(event.cookies, path.replace(/\/$/, ''));
    }

    // A reset link signed this visitor in so they could choose a new password,
    // not so they could use the account with the old one forgotten.
    if (pendingReset) {
      const resetPage = signInDestination(pendingReset);
      if (path !== resetPage) {
        redirect(307, resetPage);
      }
    }

    const isProtectedRoute = protectedRoutes.some(
      (route) => path === route || path.startsWith(`${route}/`),
    );

    // This runs before any load does, and for client-side navigations too, so
    // it is the only redirect a signed-out visitor to a protected route sees.
    if (isProtectedRoute && !session) {
      redirect(307, signInRedirect(url));
    }

    // Someone already signed in has nothing to do on a sign-in page, so they
    // go on to where it would have sent them.
    if (isSignInPage(path) && session) {
      redirect(
        307,
        signInDestination(url.searchParams.get('next') ?? undefined),
      );
    }
  }

  return withSecurityHeaders(await resolve(event));
};
