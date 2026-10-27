import { createServerClient, type NhostClient } from '@nhost/nhost-js';
import type { User } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import {
  DEFAULT_SESSION_KEY,
  type StoredSession,
} from '@nhost/nhost-js/session';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { nhostRegion, nhostSubdomain } from './env';
import { graphqlErrorMessage } from './graphql';
import {
  needsUpdate,
  requestDetails,
  type SessionMetadata,
} from './session-metadata';
import { SIGNED_IN_KEY } from './signed-in';

const key = DEFAULT_SESSION_KEY;

// How close to expiry the proxy refreshes the access token, so it stays
// usable for the time between two navigations.
export const PROXY_REFRESH_MARGIN_SECONDS = 60;

// Every session write sets two cookies: the httpOnly session, and a flag
// JavaScript can read that says one is there. See the README's design notes.
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

// Set when a password-reset link signs the visitor in, and holds the page the
// link landed on.
export const PASSWORD_RESET_KEY = 'nhostPasswordReset';
const PASSWORD_RESET_LINK_TYPE = 'passwordReset';

const sessionCookieNames = [key, SIGNED_IN_KEY, PASSWORD_RESET_KEY];

function sessionCookies(value: StoredSession) {
  return [
    { name: key, value: serializeSessionCookie(value), ...cookieOptions },
    {
      name: SIGNED_IN_KEY,
      value: '1',
      ...sharedCookieOptions,
      httpOnly: false,
      maxAge: cookieOptions.maxAge,
    },
  ];
}

// Next's cookie APIs percent-encode on write and decode on read, so these two
// only deal in JSON.
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

/** Creates an Nhost client for use in server components and server actions. */
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

/** Returns the signed-in user as the auth service sees them, or null. */
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

/** Lets the visitor leave the reset page, once the new password is saved. */
export async function endPasswordReset(): Promise<void> {
  (await cookies()).delete(PASSWORD_RESET_KEY);
}

/** Rewrites the stored session's user after a profile write has succeeded. */
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
export const LINK_TOKEN_PARAM = 'refreshToken';
export const LINK_TYPE_PARAM = 'type';

// Next fires prefetches for every <Link> in view, through this same proxy and
// concurrently with the document request. Refresh tokens are single-use, so
// a prefetch reads the stored session and never rotates; this proxy is the
// only rotator. See the README's design notes.
export function isPrefetch(request: NextRequest): boolean {
  // In a production build every default <Link> in view prefetches, sending
  // `next-router-prefetch: 1`, some with `next-router-segment-prefetch`; the
  // runtime prefetches of Cache Components send `2` and `3`.
  return (
    !!request.headers.get('next-router-prefetch') ||
    !!request.headers.get('next-router-segment-prefetch') ||
    request.headers.get('purpose') === 'prefetch'
  );
}

export type TrackedSession = 'live' | 'revoked' | 'unknown';

/**
 * Looks up the session's row in `auth.refresh_tokens`, and records where it is
 * being used from while there (see `session-metadata.ts`).
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

/** Refreshes the Nhost session from the Next.js proxy. */
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
  // device's account page, still holds an access token the backend accepts
  // until it expires.
  if (session && !isPrefetch(request)) {
    if ((await trackSession(nhost, session, request.headers)) === 'revoked') {
      nhost.clearSession();
      session = null;
    }
  }

  // A link may sign in a visitor who is signed out; it may not replace somebody
  // who is already here.
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
