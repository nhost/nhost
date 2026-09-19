import { createServerClient, type NhostClient } from '@nhost/nhost-js';
import {
  DEFAULT_SESSION_KEY,
  type StoredSession,
} from '@nhost/nhost-js/session';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { nhostRegion, nhostSubdomain } from './env';
import {
  createChallenge,
  LINK_CODE_PARAM,
  type LinkCookieOptions,
  type LinkPurpose,
  linkCookieOptions,
  PKCE_COOKIE,
  PKCE_MAX_AGE,
  parsePendingChallenge,
  RECOVERY_COOKIE,
  RECOVERY_MAX_AGE,
  recoveryCookieOptions,
} from './pkce';

const key = DEFAULT_SESSION_KEY;

// The session cookie is intentionally not httpOnly: the browser SDK in
// `client.ts` reads it via document.cookie to make client-side GraphQL
// requests. This trades XSS token exposure for client-side data fetching. To
// keep the refresh token out of JS, drop the client SDK and fetch/mutate only
// from server components and server actions, then set httpOnly: true.
//
// A week rather than a month: a token JavaScript can read is a token an XSS
// can take, and how long a stolen one keeps working is the part of that
// tradeoff this file still decides. The other part is the CSP in
// `next.config.ts`.
export const cookieOptions = {
  httpOnly: false,
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 7,
} as const;

// Next's cookie APIs percent-encode on write and decode on read, so these two
// only deal in JSON. Adding an encodeURIComponent here would put a
// double-encoded value on the wire, and the browser SDK's CookieStorage, which
// decodes once, deletes any cookie it cannot parse.
export function parseSessionCookie(raw: string | null): StoredSession | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function serializeSessionCookie(value: StoredSession): string {
  return JSON.stringify(value);
}

/**
 * Creates an Nhost client for use in server components and server actions.
 *
 * It wires the SDK's session storage to Next.js cookies so the session can be
 * read on the server. Refreshing the session happens in the proxy (see
 * `proxy.ts`), where both the request and response cookies are available.
 */
export async function createNhostClient(): Promise<NhostClient> {
  const cookieStore = await cookies();

  return createServerClient({
    region: nhostRegion(),
    subdomain: nhostSubdomain(),
    storage: {
      get: (): StoredSession | null =>
        parseSessionCookie(cookieStore.get(key)?.value || null),
      set: (value: StoredSession) => {
        cookieStore.set(key, serializeSessionCookie(value), cookieOptions);
      },
      remove: () => {
        cookieStore.delete(key);
      },
    },
  });
}

/**
 * Creates an Nhost client that is never signed in.
 *
 * Public pages have to query as the `public` role no matter who is looking.
 * `createNhostClient` would send the visitor's own token, Hasura would answer
 * as `user`, and that role's row-level filter would hide every row belonging
 * to somebody else: a signed-in visitor would get an empty page where a
 * signed-out one gets the list. Reading public data through the session is the
 * mistake this exists to make hard.
 */
export function createAnonymousClient(): NhostClient {
  return createServerClient({
    region: nhostRegion(),
    subdomain: nhostSubdomain(),
    storage: {
      get: (): StoredSession | null => null,
      set: () => {},
      remove: () => {},
    },
  });
}

/**
 * Creates an Nhost client whose session never leaves the call.
 *
 * The SDK stores every session it is handed in whatever storage it was given,
 * so the storage is the only place to decide that a session must not become
 * the browser's. Redeeming a password reset produces a session for the account
 * the link names, and writing that into the cookie is precisely the session
 * swap this app is trying not to perform.
 */
export function createMemoryClient(): NhostClient {
  let stored: StoredSession | null = null;

  return createServerClient({
    region: nhostRegion(),
    subdomain: nhostSubdomain(),
    storage: {
      get: (): StoredSession | null => stored,
      set: (value: StoredSession) => {
        stored = value;
      },
      remove: () => {
        stored = null;
      },
    },
  });
}

/**
 * Starts a link flow and returns the challenge to send with the email.
 *
 * Callable from server actions only: a Server Component cannot write cookies,
 * and the verifier has to be on this browser before the email goes out.
 */
export async function beginLinkFlow(purpose: LinkPurpose): Promise<string> {
  const { challenge, cookie } = await createChallenge(purpose);

  (await cookies()).set(PKCE_COOKIE, cookie, {
    ...linkCookieOptions,
    maxAge: PKCE_MAX_AGE,
  });

  return challenge;
}

/**
 * The refresh token a redeemed password-reset link left behind, if any.
 *
 * Its presence is what says the visitor followed a reset link in this browser.
 * It is httpOnly, so unlike the session cookie it is out of reach of anything
 * running on the page.
 */
export async function readRecoveryToken(): Promise<string | null> {
  return (await cookies()).get(RECOVERY_COOKIE)?.value || null;
}

/**
 * Re-parks the recovery token after a refresh rotated it.
 *
 * Refresh tokens rotate on use, so the moment `resetPassword` spends the parked
 * token the value in the cookie is dead. Writing the rotated token back keeps
 * the cookie live, so a rejected password stays retryable instead of failing
 * as if the link had expired. Same httpOnly options and lifetime the proxy
 * used when it first parked the token.
 */
export async function writeRecoveryToken(token: string): Promise<void> {
  (await cookies()).set(RECOVERY_COOKIE, token, {
    ...recoveryCookieOptions,
    maxAge: RECOVERY_MAX_AGE,
  });
}

export async function clearRecoveryToken(): Promise<void> {
  // Delete with the path the cookie was written on: a delete on the default
  // path silently leaves a path-scoped cookie in place.
  (await cookies()).delete({
    name: RECOVERY_COOKIE,
    path: recoveryCookieOptions.path,
  });
}

export type NhostProxyResult = {
  session: StoredSession | null;
  applySessionCookies: (response: NextResponse) => NextResponse;
  clearLinkParams: boolean;
};

// Where this app's auth emails come back to: the `redirectTo` values in
// `app/signin/actions.ts` and `app/profile/actions.ts`. It bounds where a
// `?code=` is picked up and stripped, and that is all it does. Neither this
// list nor the `type` the verify endpoint appends is a security control:
// whoever sends a URL chooses its path as freely as its query string. The one
// thing an outsider cannot author is the verifier cookie this app wrote when
// it sent the email, and that is what a code is redeemed against.
export const LINK_RETURN_PATHS = ['/reset-password', '/profile'];

/**
 * Refreshes the Nhost session from the Next.js proxy.
 *
 * Refreshing must happen in the proxy because it is the only place that can
 * update the session for both the current request and the browser. Session
 * writes go onto `request.cookies` right away, so Server Components rendering
 * this same request already see the refreshed token, and are recorded so the
 * proxy can replay them onto the response it returns via `applySessionCookies`.
 *
 * Call `applySessionCookies` on every response, including redirects: skipping
 * it leaves the browser on a stale session, or on a refresh token the SDK has
 * already rejected and asked to delete.
 */
export async function handleNhostProxy(
  request: NextRequest,
): Promise<NhostProxyResult> {
  const mutations: Array<(response: NextResponse) => void> = [];

  const setCookie = (
    name: string,
    value: string,
    options: { maxAge: number } & LinkCookieOptions,
  ): void => {
    request.cookies.set(name, value);
    mutations.push((response) => {
      response.cookies.set({ name, value, ...options });
    });
  };

  const deleteCookie = (name: string): void => {
    request.cookies.delete(name);
    mutations.push((response) => {
      response.cookies.delete(name);
    });
  };

  const storage = {
    get: (): StoredSession | null =>
      parseSessionCookie(request.cookies.get(key)?.value || null),
    set: (value: StoredSession) => {
      const serialized = serializeSessionCookie(value);
      request.cookies.set(key, serialized);
      mutations.push((response) => {
        response.cookies.set({
          name: key,
          value: serialized,
          ...cookieOptions,
        });
      });
    },
    remove: () => {
      request.cookies.delete(key);
      mutations.push((response) => {
        response.cookies.delete(key);
      });
    },
  };

  const nhost = createServerClient({
    region: nhostRegion(),
    subdomain: nhostSubdomain(),
    storage,
  });

  const code = request.nextUrl.searchParams.get(LINK_CODE_PARAM);
  const onReturnPath = LINK_RETURN_PATHS.includes(request.nextUrl.pathname);
  const pending = onReturnPath
    ? parsePendingChallenge(request.cookies.get(PKCE_COOKIE)?.value)
    : null;

  let session: StoredSession | null = null;

  if (code && pending) {
    // The exchange runs on its own client so the session it produces is not
    // written anywhere until this decides where it belongs.
    const redeemer = createMemoryClient();

    try {
      const { body } = await redeemer.auth.tokenExchange({
        code,
        codeVerifier: pending.verifier,
      });

      if (body.session) {
        // Through sessionStorage rather than straight off the response so the
        // access token is decoded into the stored shape the app reads.
        redeemer.sessionStorage.set(body.session);
        const redeemed = redeemer.sessionStorage.get();

        if (pending.purpose === 'passwordReset') {
          // A reset deliberately does not sign anybody in. The refresh token
          // is parked in an httpOnly cookie that only `/reset-password` reads,
          // so the new password lands on the account the link named even when
          // this browser was already signed into a different one.
          setCookie(RECOVERY_COOKIE, redeemed?.refreshToken ?? '', {
            ...recoveryCookieOptions,
            maxAge: RECOVERY_MAX_AGE,
          });
        } else {
          session = redeemed;
          if (redeemed) {
            storage.set(redeemed);
          }
        }

        deleteCookie(PKCE_COOKIE);
      }
    } catch (err) {
      // An expired or already-spent link is ordinary. The challenge stays put:
      // dropping it here would let any `?code=` aimed at a return path cancel
      // a reset the user is in the middle of.
      console.error('Could not redeem the link code:', err);
    }
  }

  if (!session) {
    session = await nhost.refreshSession(60);
  }

  return {
    session,
    // True whether or not the code was spent: a code that went nowhere is
    // still in history, bookmarks and the referer header.
    clearLinkParams: code !== null && onReturnPath,
    applySessionCookies: (response) => {
      for (const mutate of mutations) {
        mutate(response);
      }
      return response;
    },
  };
}
