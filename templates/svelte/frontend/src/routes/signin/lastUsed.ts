import type { Cookies } from '@sveltejs/kit';
import { cookieOptions } from '#lib/nhost/server.ts';

// How the visitor last signed in on this browser, so the sign-in list can point
// it out.
const LAST_USED_KEY = 'nhostLastSignIn';
const LAST_USED_MAX_AGE = 60 * 60 * 24 * 365;

// How the visitor is signing in right now.
const ATTEMPT_KEY = 'nhostSignInAttempt';
const ATTEMPT_MAX_AGE = 60 * 60 * 24;

/** Notes that a signed-out visitor started signing in the way `href` names. */
export function recordSignInAttempt(cookies: Cookies, href: string): void {
  cookies.set(ATTEMPT_KEY, href, { ...cookieOptions, maxAge: ATTEMPT_MAX_AGE });
}

/** Keeps the attempt as the way the visitor last signed in. */
export function promoteSignInAttempt(cookies: Cookies): void {
  const attempt = cookies.get(ATTEMPT_KEY);
  if (attempt) {
    cookies.set(LAST_USED_KEY, attempt, {
      ...cookieOptions,
      maxAge: LAST_USED_MAX_AGE,
    });
    cookies.delete(ATTEMPT_KEY, { path: '/' });
  }
}

/** The href of the way the visitor last signed in, if they have. */
export function lastUsedSignIn(cookies: Cookies): string | null {
  return cookies.get(LAST_USED_KEY) ?? null;
}
