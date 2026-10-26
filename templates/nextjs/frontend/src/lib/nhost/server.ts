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
import { graphqlErrorMessage } from './graphql';
import {
  needsUpdate,
  requestDetails,
  type SessionMetadata,
} from './session-metadata';

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

// Set when a password-reset link signs the visitor in, and holds the page the
// link landed on. The link signs them in only so the new password can be
// saved, so until it is the proxy keeps them on that page (see `proxy.ts`).
// httpOnly like the session, and removed with it, so signing out ends it too.
export const PASSWORD_RESET_KEY = 'nhostPasswordReset';
const PASSWORD_RESET_LINK_TYPE = 'passwordReset';

const sessionCookieNames = [key, ACCESS_TOKEN_KEY, PASSWORD_RESET_KEY];

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

/**
 * Lets the visitor leave the reset page, once the new password is saved.
 */
export async function endPasswordReset(): Promise<void> {
  (await cookies()).delete(PASSWORD_RESET_KEY);
}

/**
 * Rewrites the stored session's user after a profile write has succeeded.
 *
 * The nav and the home page render the user from the session cookie, and the
 * cookie's copy is otherwise replaced only when the proxy refreshes the token,
 * which with a 900 s token can be a quarter of an hour after the change. This
 * patches it in place, keeping the tokens as they are: a refresh here would
 * make the action a second rotator next to the proxy, see `handleNhostProxy`.
 */
export function updateSessionUser(
  nhost: NhostClient,
  patch: Partial<User>,
): void {
  const session = nhost.getUserSession();

  if (!session?.user) {
    return;
  }

  nhost.sessionStorage.set({
    ...session,
    user: { ...session.user, ...patch },
  });
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
export function isPrefetch(request: NextRequest): boolean {
  // In a production build every default <Link> in view prefetches, sending
  // `next-router-prefetch: 1`, some with `next-router-segment-prefetch`; the
  // runtime prefetches of Cache Components send `2` and `3`. Any value counts,
  // since the values are Next internals. `prefetch={true}` is the gap: that
  // request carries no prefetch header and looks like a navigation, so it
  // rotates, and a project that turns it on reopens the race.
  return (
    !!request.headers.get('next-router-prefetch') ||
    !!request.headers.get('next-router-segment-prefetch') ||
    request.headers.get('purpose') === 'prefetch'
  );
}

export type TrackedSession = 'live' | 'revoked' | 'unknown';

/**
 * Looks up the session's row in `auth.refresh_tokens`, and records where it
 * is being used from while there (see `session-metadata.ts`).
 *
 * Rotation keeps the row's id and revocation deletes the row, so no row means
 * the session is over. Any failure to ask, including the permissions in
 * nhost/metadata not being applied, answers `unknown` and the session stays:
 * a check that signs people out whenever GraphQL is unreachable would be worse
 * than the minutes it saves.
 */
export async function trackSession(
  nhost: NhostClient,
  session: StoredSession,
  headers: Headers,
): Promise<TrackedSession> {
  const id = session.refreshTokenId;

  if (!id) {
    return 'unknown';
  }

  try {
    const { body } = await nhost.graphql.request<{
      authRefreshToken: { id: string; metadata: SessionMetadata | null } | null;
    }>({
      query: `query Session($id: uuid!) {
        authRefreshToken(id: $id) { id metadata }
      }`,
      variables: { id },
    });

    if (body.errors?.length) {
      console.error(
        'Could not check the session:',
        graphqlErrorMessage(body.errors),
      );
      return 'unknown';
    }

    const row = body.data?.authRefreshToken;
    if (row === null) {
      return 'revoked';
    }
    if (!row) {
      return 'unknown';
    }

    const current = requestDetails(headers);
    if (needsUpdate(row.metadata, current)) {
      const metadata: SessionMetadata = {
        ...current,
        seenAt: new Date().toISOString(),
      };
      const { body: updated } = await nhost.graphql.request({
        query: `mutation SeenSession($id: uuid!, $metadata: jsonb!) {
          updateAuthRefreshToken(pk_columns: { id: $id }, _set: { metadata: $metadata }) { id }
        }`,
        variables: { id, metadata },
      });

      if (updated.errors?.length) {
        console.error(
          'Could not record the session:',
          graphqlErrorMessage(updated.errors),
        );
      }
    }

    return 'live';
  } catch (err) {
    console.error('Could not check the session:', err);
    return 'unknown';
  }
}

export type NhostProxyResult = {
  session: StoredSession | null;
  // The reset page a password-reset link signed this session in on, while
  // the new password is still to be saved.
  pendingReset: string | null;
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

  // A session revoked from elsewhere, by a password change or from another
  // device's account page, still holds an access token the backend
  // accepts until it expires. Only the refresh token's row says it is over, so
  // every real navigation looks for it. Prefetches do not: nobody is looking
  // at their response yet, and the navigation that follows checks.
  if (session && !isPrefetch(request)) {
    if ((await trackSession(nhost, session, request.headers)) === 'revoked') {
      nhost.clearSession();
      session = null;
    }
  }

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

      if (
        request.nextUrl.searchParams.get(LINK_TYPE_PARAM) ===
        PASSWORD_RESET_LINK_TYPE
      ) {
        const page = request.nextUrl.pathname;
        request.cookies.set(PASSWORD_RESET_KEY, page);
        mutations.push((response) => {
          response.cookies.set({
            name: PASSWORD_RESET_KEY,
            value: page,
            ...cookieOptions,
          });
        });
      }
    } catch (err) {
      // An expired or already-used link is normal; fall through and let the
      // page handle an anonymous visitor.
      console.error('Could not redeem the link token:', err);
    }
  }

  return {
    session,
    pendingReset: session
      ? (request.cookies.get(PASSWORD_RESET_KEY)?.value ?? null)
      : null,
    applySessionCookies: (response) => {
      for (const mutate of mutations) {
        mutate(response);
      }
      return response;
    },
  };
}
