import { createServerClient, type NhostClient } from '@nhost/nhost-js';
import {
  DEFAULT_SESSION_KEY,
  type StoredSession,
} from '@nhost/nhost-js/session';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { nhostRegion, nhostSubdomain } from './env';

const key = DEFAULT_SESSION_KEY;

// The session cookie is intentionally not httpOnly: the browser SDK in
// `client.ts` reads it via document.cookie to make client-side GraphQL
// requests. This trades XSS token exposure for client-side data fetching. To
// keep the refresh token out of JS, drop the client SDK and fetch/mutate only
// from server components and server actions, then set httpOnly: true.
export const cookieOptions = {
  httpOnly: false,
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 30,
} as const;

// Set by the proxy when it redeems a password-reset link, and the only thing
// that lets `changePassword` skip asking for the current one. It is the
// server's own record that this browser just proved control of the account's
// mailbox, which is why nothing the client sends can stand in for it. Unlike
// the session cookie there is no reason for JS to read it, so it is httpOnly.
export const PASSWORD_RESET_GRANT_COOKIE = 'nhostPasswordResetGrant';

export const passwordResetGrantOptions = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  // Long enough to pick a password, short enough that a shared machine does
  // not carry the exemption into somebody else's visit.
  maxAge: 15 * 60,
} as const;

/**
 * Whether this request arrived with a live password-reset grant.
 *
 * Read from a server action to decide whether setting a password may skip
 * re-authentication.
 */
export async function hasPasswordResetGrant(): Promise<boolean> {
  const cookieStore = await cookies();

  return cookieStore.get(PASSWORD_RESET_GRANT_COOKIE) !== undefined;
}

/** Spends the grant, so one reset link sets one password. */
export async function clearPasswordResetGrant(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(PASSWORD_RESET_GRANT_COOKIE);
}

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

export type NhostProxyResult = {
  session: StoredSession | null;
  applySessionCookies: (response: NextResponse) => NextResponse;
  consumedLinkToken: boolean;
};

// Auth emails (password reset, email change) send the user to the verify
// endpoint, which signs them in and redirects back with the refresh token in
// the query string. Nothing else in the app picks that up, so without this the
// whole link lands on a page with no session.
export const LINK_TOKEN_PARAM = 'refreshToken';
export const LINK_TYPE_PARAM = 'type';

// The ticket types the auth service puts on that redirect. Anything else did
// not come from an auth email.
const LINK_TYPES = new Set([
  'emailConfirmChange',
  'emailVerify',
  'passwordReset',
  'signinPasswordless',
]);

// The only paths this template's own auth emails come back to, which is the
// `redirectTo` each of them asks for. Add a path here when an email starts
// pointing at a new one.
const LINK_REDEMPTION_PATHS = new Set(['/profile', '/reset-password']);

/**
 * The refresh token to redeem on this request, if this request is one an auth
 * email could plausibly have produced.
 *
 * Redeeming on sight, anywhere, is login CSRF: a link to any page of the app
 * with someone else's `refreshToken` on it silently replaces the visitor's
 * session with the attacker's, and everything they write next lands in the
 * attacker's account. Neither condition below is a secret - they are what the
 * auth service actually emits - but together they mean a redemption can only
 * happen where this app's own emails land.
 */
function redeemableLinkToken(request: NextRequest): string | null {
  const token = request.nextUrl.searchParams.get(LINK_TOKEN_PARAM);
  if (!token) {
    return null;
  }

  const type = request.nextUrl.searchParams.get(LINK_TYPE_PARAM);
  if (!type || !LINK_TYPES.has(type)) {
    return null;
  }

  if (!LINK_REDEMPTION_PATHS.has(request.nextUrl.pathname)) {
    return null;
  }

  return token;
}

// Next fires prefetches for every <Link> in view, through this same proxy and
// concurrently with the document request. Refresh tokens rotate server-side,
// so only one of those can win; the losers retry with a token the backend has
// already replaced, and once the access token has genuinely expired the SDK
// reacts to that failure by clearing the session. That presents as being
// randomly signed out after leaving a tab idle. A prefetch reads the stored
// session instead, which is enough to decide access for a response nobody is
// looking at yet, and leaves rotation to the request that is really happening.
function isPrefetch(request: NextRequest): boolean {
  return (
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch'
  );
}

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

  const linkToken = redeemableLinkToken(request);
  let consumedLinkToken = false;
  let session: StoredSession | null = null;

  if (linkToken) {
    try {
      const { body } = await nhost.auth.refreshToken({
        refreshToken: linkToken,
      });
      // Goes through sessionStorage rather than the backend directly so the
      // access token is decoded into the stored shape the app reads.
      nhost.sessionStorage.set(body);
      session = nhost.sessionStorage.get();
      consumedLinkToken = true;

      // Redeeming the link is the proof of mailbox control that stands in for
      // knowing the current password, and this is the only place it exists.
      if (
        request.nextUrl.searchParams.get(LINK_TYPE_PARAM) === 'passwordReset'
      ) {
        mutations.push((response) => {
          response.cookies.set({
            name: PASSWORD_RESET_GRANT_COOKIE,
            value: '1',
            ...passwordResetGrantOptions,
          });
        });
      }
    } catch (err) {
      // An expired or already-used link is normal; fall through and let the
      // page handle an anonymous visitor.
      console.error('Could not redeem the link token:', err);
    }
  }

  if (!session) {
    session = isPrefetch(request)
      ? storage.get()
      : await nhost.refreshSession(60);
  }

  return {
    session,
    consumedLinkToken,
    applySessionCookies: (response) => {
      for (const mutate of mutations) {
        mutate(response);
      }
      return response;
    },
  };
}
