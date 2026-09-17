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
// that lets `changePassword` skip asking for the current one.
//
// Its value is the id of the account the link signed in, and `changePassword`
// requires that to match the session it is about to act on. Carrying the
// account matters: a bare marker says only "a reset link was redeemed in this
// browser", which is true of a browser that redeemed one for *another* account,
// and spending it against whoever the session belongs to is then a password
// takeover with no proof about that account at all.
//
// What the grant proves is worth stating exactly, because it is narrower than
// it looks: this browser redeemed a reset link for this account. It is not
// proof of control of the account's mailbox. The session cookie is readable by
// JS (see `cookieOptions`), so anyone already holding a live refresh token can
// put it on a `?refreshToken=...&type=passwordReset` URL and mint a grant for
// their own account without any email. That is a consequence of the
// browser-readable session rather than of this cookie, and it is why the grant
// is not described as mailbox proof anywhere. Closing it needs the auth
// service's PKCE flow, whose redeemed `code` is bound to the ticket itself.
//
// In production the name takes the `__Host-` prefix, which pins the cookie to
// this exact host: a sibling subdomain cannot plant one with `Domain=`, and the
// browser enforces `Secure` and `Path=/` on it. The prefix requires `Secure`,
// so it is dropped in development, where the app is served over plain http on
// localhost and has no sibling subdomains to be tossed one from. The session
// cookie cannot do the same because the browser SDK owns its name.
export const PASSWORD_RESET_GRANT_COOKIE =
  process.env.NODE_ENV === 'production'
    ? '__Host-nhostPasswordResetGrant'
    : 'nhostPasswordResetGrant';

export const passwordResetGrantOptions = {
  // Nothing in the browser has any reason to read this, and unlike the session
  // cookie it is ours alone to name, so it gets the treatment the session
  // cookie cannot have.
  httpOnly: true,
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  // Long enough to pick a password. Short because it is an exemption from
  // re-authentication: see `/reset-password`, which tells the visitor to ask
  // for a fresh link rather than showing a form that can no longer succeed.
  maxAge: 15 * 60,
} as const;

/**
 * The account a live password-reset grant on this request was issued for, or
 * null when there is none.
 *
 * Read from a server action to decide whether setting a password may skip
 * re-authentication. The caller must compare it against the session it is
 * acting on; a grant for somebody else is no grant at all.
 */
export async function passwordResetGrantUserId(): Promise<string | null> {
  const cookieStore = await cookies();

  return cookieStore.get(PASSWORD_RESET_GRANT_COOKIE)?.value || null;
}

/**
 * Spends the grant, so one reset link sets one password.
 *
 * The path is repeated from `passwordResetGrantOptions` because a delete has to
 * match the cookie's path to remove it. Without it a server action running on a
 * nested route would emit a delete for that route's own path, the browser would
 * keep the cookie, and the exemption would outlive the reset it was for.
 */
export async function clearPasswordResetGrant(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete({ name: PASSWORD_RESET_GRANT_COOKIE, path: '/' });
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

/**
 * Which account a session belongs to.
 *
 * `user` is the obvious answer and the one the auth service always sends, but
 * the type makes it optional, so the token's own subject claim backs it up.
 * A session that cannot name its account is not one anything here should act
 * on, so the answer is allowed to be undefined rather than guessed at.
 */
function sessionUserId(
  session: StoredSession | null | undefined,
): string | undefined {
  if (session?.user?.id) {
    return session.user.id;
  }

  const sub = session?.decodedToken?.sub;

  return typeof sub === 'string' && sub ? sub : undefined;
}

// Auth emails (password reset, email change) send the user to the verify
// endpoint, which signs them in and redirects back with the refresh token in
// the query string. Nothing else in the app picks that up, so without this the
// whole link lands on a page with no session.
export const LINK_TOKEN_PARAM = 'refreshToken';
export const LINK_TYPE_PARAM = 'type';

// The ticket types the auth service puts on that redirect. Anything else did
// not come from an auth email.
//
// These are the `TicketType` constants, which is what the redirect carries -
// see `getTicketType` in `services/auth/go/controller/verify_ticket.go`. They
// are not the `LinkType` names used to request an email, and the two differ in
// exactly the confusing places: a verification link arrives as `verifyEmail`,
// not `emailVerify`, and a magic link as `passwordlessEmail`, not
// `signinPasswordless`. Getting that backwards rejects a real link silently and
// lands the visitor anonymous.
const LINK_TYPES = new Set([
  'emailConfirmChange',
  'passwordlessEmail',
  'passwordReset',
  'verifyEmail',
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
      // Both read before the call, because the SDK persists the session of a
      // successful refresh through this same storage: afterwards the "existing"
      // session is already the redeemed one, and the comparison below would be
      // the redeemed token against itself.
      const signedInSession = storage.get();
      const signedInUserId = sessionUserId(signedInSession);
      const writtenBefore = mutations.length;

      const { body } = await nhost.auth.refreshToken({
        refreshToken: linkToken,
      });

      const redeemedUserId = body.user?.id;

      if (signedInUserId && signedInUserId !== redeemedUserId) {
        // Narrowing redemption to the paths auth emails land on reduced login
        // CSRF but did not end it: a crafted link on one of those paths would
        // still swap a signed-in visitor's session for the attacker's, the
        // params would be stripped on the way out, and the victim would carry
        // on writing into somebody else's account with a clean URL and no sign
        // that anything happened. A link may sign in a visitor who is signed
        // out; it may not replace somebody who is already here.
        //
        // The token has been spent against the backend by now, which is the
        // right outcome for a token that was not this visitor's to redeem.
        //
        // Undoing the SDK's own write is what makes the refusal real: it has
        // already put the redeemed session into this request and queued it for
        // the response, so without this the visitor would leave signed in as
        // whoever sent the link.
        mutations.length = writtenBefore;
        if (signedInSession) {
          request.cookies.set(key, serializeSessionCookie(signedInSession));
        } else {
          request.cookies.delete(key);
        }

        console.error(
          'Refused a link token for a different account than the session',
        );
      } else {
        // Goes through sessionStorage rather than the backend directly so the
        // access token is decoded into the stored shape the app reads.
        nhost.sessionStorage.set(body);
        session = nhost.sessionStorage.get();
        consumedLinkToken = true;

        // Following a reset link is what stands in for knowing the current
        // password, and this is the only place that fact exists. It is
        // recorded against the account the link just signed in, so it cannot
        // later be spent on a different one.
        const grantUserId = session?.user?.id ?? redeemedUserId;
        if (
          grantUserId &&
          request.nextUrl.searchParams.get(LINK_TYPE_PARAM) === 'passwordReset'
        ) {
          mutations.push((response) => {
            response.cookies.set({
              name: PASSWORD_RESET_GRANT_COOKIE,
              value: grantUserId,
              ...passwordResetGrantOptions,
            });
          });
        }
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
