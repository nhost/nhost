import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { cookieOptions } from '@/lib/nhost/server';

// How the visitor last signed in on this browser, so the sign-in list can
// point it out. Kept apart from the session cookies, because the moment it is
// useful is after signing out. The value is the href the list links that
// way in by: a method's page, or a provider's route under `/auth/oauth/`.
const LAST_USED_KEY = 'nhostLastSignIn';
const LAST_USED_MAX_AGE = 60 * 60 * 24 * 365;

// How the visitor is signing in right now. It only becomes the last used once
// a session starts, so a way in they open and back out of changes nothing. It
// outlives the page because a verification email can be opened the next day.
const ATTEMPT_KEY = 'nhostSignInAttempt';
const ATTEMPT_MAX_AGE = 60 * 60 * 24;

/** Notes that a signed-out visitor started signing in the way `href` names. */
export function recordSignInAttempt(
  response: NextResponse,
  href: string,
): NextResponse {
  response.cookies.set({
    name: ATTEMPT_KEY,
    value: href,
    ...cookieOptions,
    maxAge: ATTEMPT_MAX_AGE,
  });
  return response;
}

/**
 * Keeps the attempt as the way the visitor last signed in. Called on any
 * request with a session, which is where every way in ends up: a form's
 * redirect and a link token alike.
 */
export function promoteSignInAttempt(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const attempt = request.cookies.get(ATTEMPT_KEY)?.value;
  if (attempt) {
    response.cookies.set({
      name: LAST_USED_KEY,
      value: attempt,
      ...cookieOptions,
      maxAge: LAST_USED_MAX_AGE,
    });
    response.cookies.delete(ATTEMPT_KEY);
  }
  return response;
}

/**
 * The href of the way the visitor last signed in, if they have. Only ever
 * compared against the list's own hrefs: the cookie is the visitor's to edit.
 */
export async function lastUsedSignIn(): Promise<string | null> {
  return (await cookies()).get(LAST_USED_KEY)?.value ?? null;
}
