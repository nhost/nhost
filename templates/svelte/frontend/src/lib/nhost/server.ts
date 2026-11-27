import {
  type ClientConfigurationFn,
  createServerClient,
  generateServiceUrl,
  type NhostClient,
} from '@nhost/nhost-js';
import { createAPIClient, type User } from '@nhost/nhost-js/auth';
import { type FetchError, withHeadersMiddleware } from '@nhost/nhost-js/fetch';
import {
  DEFAULT_SESSION_KEY,
  type StoredSession,
} from '@nhost/nhost-js/session';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { nhostRegion, nhostSubdomain } from './env.server.ts';
import { graphqlErrorMessage } from './graphql.ts';

const key = DEFAULT_SESSION_KEY;

// How close to expiry the hook refreshes the access token, so it stays usable
// for the time between two navigations.
const REFRESH_MARGIN_SECONDS = 60;

// SvelteKit leaves `secure` off only on http://localhost.
export const cookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 30,
} as const;

// Set when a password-reset link signs the visitor in, and holds the page the
// link landed on.
export const PASSWORD_RESET_KEY = 'nhostPasswordReset';
const PASSWORD_RESET_LINK_TYPE = 'passwordReset';

// Names a refresh token the hook has seen rejected, and when, as
// `<refreshTokenId>.<epoch ms>`. See "How it works" in the README.
const REFRESH_REJECTED_KEY = 'nhostRefreshRejected';
const REFRESH_REJECTED_GRACE_MS = 5000;

const sessionCookieNames = [key, PASSWORD_RESET_KEY, REFRESH_REJECTED_KEY];

// SvelteKit's cookie APIs percent-encode on write and decode on read, so these
// two only deal in JSON.
function parseSessionCookie(raw: string | undefined): StoredSession | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

function serializeSessionCookie(value: StoredSession): string {
  return JSON.stringify(value);
}

function readSession({ cookies, locals }: RequestEvent): StoredSession | null {
  return locals.sessionRejected ? null : parseSessionCookie(cookies.get(key));
}

function writeSession(
  { cookies, locals }: RequestEvent,
  value: StoredSession,
): void {
  locals.sessionRejected = false;
  cookies.set(key, serializeSessionCookie(value), cookieOptions);
}

function clearSessionCookies(cookies: Cookies): void {
  for (const name of sessionCookieNames) {
    cookies.delete(name, { path: '/' });
  }
}

// Auth rate-limits by the caller's address, which for every call from here is
// the server's. See "Rate limits" in the README.
function forwardVisitorAddress(event: RequestEvent): ClientConfigurationFn {
  const ip = event.getClientAddress();

  return ({ auth }) => {
    auth.pushChainFunction(withHeadersMiddleware({ 'X-Forwarded-For': ip }));
  };
}

/**
 * Creates an Nhost client for loads, remote functions and endpoints, reading
 * and writing the session cookie of the request it runs in.
 */
export function createNhostClient(
  event: RequestEvent = getRequestEvent(),
): NhostClient {
  return createServerClient({
    region: nhostRegion(),
    subdomain: nhostSubdomain(),
    configure: [forwardVisitorAddress(event)],
    storage: {
      get: () => readSession(event),
      set: (value: StoredSession) => writeSession(event, value),
      remove: () => clearSessionCookies(event.cookies),
    },
  });
}

/** Returns the signed-in user as the auth service sees them, or null. */
export async function getVerifiedUser(): Promise<User | null> {
  const nhost = createNhostClient();

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
export function endPasswordReset(): void {
  getRequestEvent().cookies.delete(PASSWORD_RESET_KEY, { path: '/' });
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

/** Whether `path` is one of the app's API routes, such as the avatar route. */
export const isApiRoute = (path: string): boolean => path.startsWith('/api/');

// Remote queries and API routes run alongside the page that asked for them:
// the queries it awaits, the avatars its <img> tags load. Refresh tokens are
// single-use, so these read the stored session and never rotate; page loads
// and writes do. See "How it works" in the README.
export function isReadOnly(event: RequestEvent): boolean {
  return (
    (event.isRemoteRequest && event.request.method === 'GET') ||
    isApiRoute(event.url.pathname)
  );
}

type CheckedSession = 'live' | 'revoked' | 'unknown';

/** Whether the session's row in `auth.refresh_tokens` still exists. */
async function checkSession(
  nhost: NhostClient,
  session: StoredSession,
): Promise<CheckedSession> {
  const id = session.refreshTokenId;

  if (!id) {
    return 'unknown';
  }

  try {
    const { body } = await nhost.graphql.request<{
      authRefreshToken: { id: string } | null;
    }>({
      query: `query Session($id: uuid!) {
        authRefreshToken(id: $id) { id }
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
    return row ? 'live' : 'unknown';
  } catch (err) {
    console.error('Could not check the session:', err);
    return 'unknown';
  }
}

// A bare client: the hook's own clears the stored session on any /signout.
async function revokeLinkToken(refreshToken: string): Promise<void> {
  try {
    await createAPIClient(
      generateServiceUrl('auth', nhostSubdomain(), nhostRegion()),
    ).signOut({ refreshToken });
  } catch (err) {
    console.error('Could not revoke the declined link token:', err);
  }
}

export type NhostRequestResult = {
  session: StoredSession | null;
  // The reset page a password-reset link signed this session in on, while
  // the new password is still to be saved.
  pendingReset: string | null;
};

/**
 * Refreshes the Nhost session from the server hook, and records the result on
 * `event.locals`.
 */
export async function handleNhostRequest(
  event: RequestEvent,
): Promise<NhostRequestResult> {
  const { cookies, locals, url } = event;
  locals.sessionRejected = false;

  const storage = {
    get: () => readSession(event),
    set: (value: StoredSession) => writeSession(event, value),
    // Only a rejected refresh gets here. A request that lost a race to rotate
    // the same token is rejected too, and so is one the browser sends before
    // the winner's cookie lands. So a rejection only signs this request out,
    // until the same token is rejected again after the grace period.
    remove: () => {
      const id = storage.get()?.refreshTokenId;
      const [markedId, markedAt] = (
        cookies.get(REFRESH_REJECTED_KEY) ?? ''
      ).split('.');
      const marked = !!id && markedId === id;
      if (
        !id ||
        (marked &&
          Date.now() - (Number(markedAt) || 0) >= REFRESH_REJECTED_GRACE_MS)
      ) {
        clearSessionCookies(cookies);
        return;
      }

      locals.sessionRejected = true;
      if (marked) {
        return;
      }
      cookies.set(REFRESH_REJECTED_KEY, `${id}.${Date.now()}`, {
        ...cookieOptions,
        maxAge: 60,
      });
    },
  };

  const nhost = createServerClient({
    region: nhostRegion(),
    subdomain: nhostSubdomain(),
    configure: [forwardVisitorAddress(event)],
    storage,
  });

  let session = isReadOnly(event)
    ? storage.get()
    : await nhost.refreshSession(REFRESH_MARGIN_SECONDS);

  // A session revoked from elsewhere, by a password change or from another
  // device's account page, still holds an access token the backend accepts
  // until it expires.
  if (session && !isReadOnly(event)) {
    if ((await checkSession(nhost, session)) === 'revoked') {
      clearSessionCookies(cookies);
      session = null;
    }
  }

  // A link may sign in a visitor who is signed out; it may not replace somebody
  // who is already here, and the session it carries is revoked instead. A
  // remote call carries the URL of the page that made it, whose token the
  // page's own request already dealt with.
  const linkToken = event.isRemoteRequest
    ? null
    : url.searchParams.get(LINK_TOKEN_PARAM);
  if (linkToken && storage.get()) {
    await revokeLinkToken(linkToken);
  } else if (linkToken) {
    try {
      const { body } = await nhost.auth.refreshToken({
        refreshToken: linkToken,
      });

      // Goes through sessionStorage rather than the backend directly so the
      // access token is decoded into the stored shape the app reads.
      nhost.sessionStorage.set(body);
      session = nhost.sessionStorage.get();

      if (url.searchParams.get(LINK_TYPE_PARAM) === PASSWORD_RESET_LINK_TYPE) {
        cookies.set(PASSWORD_RESET_KEY, url.pathname, cookieOptions);
      }
    } catch (err) {
      // An expired or already-used link is normal; fall through and let the
      // page handle an anonymous visitor.
      console.error('Could not redeem the link token:', err);
    }
  }

  const result = {
    session,
    pendingReset: session ? (cookies.get(PASSWORD_RESET_KEY) ?? null) : null,
  };
  locals.session = result.session;
  locals.pendingReset = result.pendingReset;
  return result;
}
