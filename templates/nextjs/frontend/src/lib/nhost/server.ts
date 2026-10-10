import { createServerClient, type NhostClient } from '@nhost/nhost-js';
import type { User } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import {
  DEFAULT_SESSION_KEY,
  type StoredSession,
} from '@nhost/nhost-js/session';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_TOKEN_KEY,
  secondsUntilExpiry,
  serializeAccessTokenCookie,
} from './access-token';
import { nhostRegion, nhostSubdomain } from './env';

const key = DEFAULT_SESSION_KEY;

// How close to expiry the proxy refreshes the access token. The browser client
// (`client.ts`) never refreshes on its own, so this margin is what keeps the
// token usable for the time between two navigations.
export const PROXY_REFRESH_MARGIN_SECONDS = 60;

// Every session write sets two cookies. The session cookie holds the whole
// session, refresh token included, and is httpOnly: only the proxy and server
// code read it. The browser client (`client.ts`) never refreshes, so all it
// needs is the access token, which goes into a second cookie JavaScript can
// read (see `access-token.ts`). An XSS can still lift that token, but it stops
// working when the token expires instead of holding the session for 30 days.
const sharedCookieOptions = {
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
} as const;

export const cookieOptions = {
  ...sharedCookieOptions,
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 30,
} as const;

// The access-token cookie lives exactly as long as the token in it. The proxy
// refreshes ahead of that and rewrites it, so a browser only goes without one
// after sitting idle past the token's expiry.
function accessTokenCookieOptions(session: StoredSession) {
  return {
    ...sharedCookieOptions,
    httpOnly: false,
    maxAge: secondsUntilExpiry(session.decodedToken),
  };
}

const sessionCookieNames = [key, ACCESS_TOKEN_KEY];

function sessionCookies(value: StoredSession) {
  return [
    { name: key, value: serializeSessionCookie(value), ...cookieOptions },
    {
      name: ACCESS_TOKEN_KEY,
      value: serializeAccessTokenCookie(value),
      ...accessTokenCookieOptions(value),
    },
  ];
}

// Next's cookie APIs percent-encode on write and decode on read, so these two
// only deal in JSON. Adding an encodeURIComponent here, or in
// `serializeAccessTokenCookie`, would put a double-encoded value on the wire,
// and the browser's reader, which decodes once, would find no session in it.
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
        for (const cookie of sessionCookies(value)) {
          cookieStore.set(cookie);
        }
      },
      remove: () => {
        for (const name of sessionCookieNames) {
          cookieStore.delete(name);
        }
      },
    },
  });
}

/**
 * Returns the signed-in user as the auth service sees them, or null.
 *
 * `getUserSession()` only parses the session cookie: nothing checks its
 * signature, so anyone can write one claiming any user and any expiry. That is
 * fine for UI hints, not for access decisions. This sends the access token to
 * the auth service, which validates it, and returns the user from its response
 * rather than the one in the cookie. Use it wherever a page or action acts on
 * who the visitor is.
 */
export async function getVerifiedUser(): Promise<User | null> {
  const nhost = await createNhostClient();

  if (!nhost.getUserSession()) {
    return null;
  }

  try {
    const { body } = await nhost.auth.getUser();
    // The SDK turns an empty 2xx into `{}`, which is truthy but no user.
    return body?.id ? body : null;
  } catch (err) {
    // A 401 is a token the auth service did not issue or no longer accepts.
    // Anything else means it could not answer, which is worth seeing in logs.
    if ((err as FetchError).status !== 401) {
      console.error('Could not verify the session:', err);
    }
    return null;
  }
}

// Auth emails and the OAuth callback send the user to the auth service, which
// signs them in and redirects back with a refresh token in the query string.
// Nothing else in the app picks that up, so without the proxy redeeming it the
// whole link would land on a page with no session.
export const LINK_TOKEN_PARAM = 'refreshToken';
export const LINK_TYPE_PARAM = 'type';

// Next fires prefetches for every <Link> in view, through this same proxy and
// concurrently with the document request. Refresh tokens rotate server-side,
// so only one of those can win; the losers retry with a token the backend has
// already replaced, and once the access token has genuinely expired the SDK
// reacts to that failure by clearing the session. That presents as being
// randomly signed out after leaving a tab idle. A prefetch reads the stored
// session instead, which is enough to pick a redirect for a response nobody is
// looking at yet, and leaves rotation to the request that is really happening.
// It is never an access check: pages that need one call `getVerifiedUser`.
//
// This proxy is the *only* rotator, by design: the browser `nhost` client
// (`@/lib/nhost/client`) is built without the SDK's own auto-refresh
// middleware and only ever sees the access token, never the refresh token in
// the httpOnly session cookie. Handing the browser that token so it could
// refresh reopens exactly the race this function guards against, just with the
// browser as the second rotator instead of a prefetch.
function isPrefetch(request: NextRequest): boolean {
  // `2` is what the PPR runtime sends; `1` is the classic prefetch. Neither
  // arises in the template as it ships, but both do the moment somebody turns
  // PPR on or passes `prefetch` to a <Link>.
  const prefetch = request.headers.get('next-router-prefetch');

  return (
    prefetch === '1' ||
    prefetch === '2' ||
    request.headers.get('purpose') === 'prefetch'
  );
}

export type NhostProxyResult = {
  session: StoredSession | null;
  applySessionCookies: (response: NextResponse) => NextResponse;
};

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
      const cookies = sessionCookies(value);
      for (const cookie of cookies) {
        request.cookies.set(cookie.name, cookie.value);
      }
      mutations.push((response) => {
        for (const cookie of cookies) {
          response.cookies.set(cookie);
        }
      });
    },
    remove: () => {
      for (const name of sessionCookieNames) {
        request.cookies.delete(name);
      }
      mutations.push((response) => {
        for (const name of sessionCookieNames) {
          response.cookies.delete(name);
        }
      });
    },
  };

  const nhost = createServerClient({
    region: nhostRegion(),
    subdomain: nhostSubdomain(),
    storage,
  });

  let session = isPrefetch(request)
    ? storage.get()
    : await nhost.refreshSession(PROXY_REFRESH_MARGIN_SECONDS);

  // A link may sign in a visitor who is signed out; it may not replace somebody
  // who is already here. Redeeming on sight would let a crafted link swap a
  // signed-in visitor's session for the sender's, and everything they wrote
  // next would land in the sender's account. Checked after the refresh, which
  // deletes a cookie the auth service rejects, so a dead session does not
  // cost the visitor a link that still works.
  const linkToken = request.nextUrl.searchParams.get(LINK_TOKEN_PARAM);
  if (linkToken && !storage.get()) {
    try {
      const { body } = await nhost.auth.refreshToken({
        refreshToken: linkToken,
      });

      // Goes through sessionStorage rather than the backend directly so the
      // access token is decoded into the stored shape the app reads.
      nhost.sessionStorage.set(body);
      session = nhost.sessionStorage.get();
    } catch (err) {
      // An expired or already-used link is normal; fall through and let the
      // page handle an anonymous visitor.
      console.error('Could not redeem the link token:', err);
    }
  }

  return {
    session,
    applySessionCookies: (response) => {
      for (const mutate of mutations) {
        mutate(response);
      }
      return response;
    },
  };
}
