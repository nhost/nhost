import type { NhostClient } from '@nhost/nhost-js';
import type { ErrorResponseError } from '@nhost/nhost-js/auth';

/**
 * The query parameter the auth service puts a refresh token in when it sends
 * the browser back here: the magic link, the email verification link, the
 * password reset link and the OAuth callback all arrive this way.
 */
export const LINK_TOKEN_PARAM = 'refreshToken';

/**
 * What the auth service sends back instead of a token when the redirect
 * failed: a provider that is not enabled or refused the sign-in, or an email
 * link that expired or was already used. `error` is a code, and
 * `errorDescription` is the service's sentence for it.
 */
const LINK_ERROR_PARAM = 'error';
const LINK_ERROR_DESCRIPTION_PARAM = 'errorDescription';

const LINK_PARAMS = [
  LINK_TOKEN_PARAM,
  LINK_ERROR_PARAM,
  LINK_ERROR_DESCRIPTION_PARAM,
];

// The visitor is told this app's own sentence, never `errorDescription`.
// Anyone can send a link to this site with whatever description they like,
// and showing it would let them put their words on this page. The codes the
// service sends have fixed descriptions anyway, so nothing is lost.
//
// A `Map`, not an object: the code comes off the URL, and `?error=__proto__`
// or `?error=toString` would find what every object inherits, which a template
// prints as `{}` or as a function's source.
const LINK_ERROR_MESSAGES: ReadonlyMap<string, string> = new Map<
  ErrorResponseError,
  string
>([
  [
    'disabled-endpoint',
    'That sign-in method is not enabled on the backend yet.',
  ],
  [
    'invalid-ticket',
    'That link has expired or was already used. Request another one.',
  ],
  [
    'unverified-user',
    'Verify your email address with the link sent to it, then sign in.',
  ],
  ['signup-disabled', 'This app is not taking new sign-ups.'],
  ['disabled-user', 'This account has been disabled.'],
]);

// The rest are a refused or expired provider sign-in, an internal error, or
// any code at all when the service conceals errors. Some would work on a
// second attempt and some would not, so this does not say which.
const FALLBACK_LINK_ERROR = 'Signing in did not work.';

export function linkErrorMessage(code: string): string {
  return LINK_ERROR_MESSAGES.get(code) ?? FALLBACK_LINK_ERROR;
}

/**
 * What to tell the visitor when this page load arrived with an error from the
 * auth service rather than a token, or null when it did not.
 *
 * Read before `redeemLinkToken`, which takes it off the URL.
 */
export function readLinkError(): string | null {
  const code = new URLSearchParams(window.location.search).get(
    LINK_ERROR_PARAM,
  );

  return code ? linkErrorMessage(code) : null;
}

/**
 * Turns the token on the URL into a stored session, and takes it off the URL,
 * along with any error the auth service sent in its place.
 *
 * In an app with a server this is the server's job, because the token can be
 * redeemed once and a page that renders twice would burn it. Here there is no
 * server, so it happens once on startup, before anything reads the session.
 *
 * Exchanging it goes through the client's own middleware, which writes the
 * session to storage, so there is nothing to persist by hand.
 */
export async function redeemLinkToken(nhost: NhostClient): Promise<void> {
  const url = new URL(window.location.href);
  const token = url.searchParams.get(LINK_TOKEN_PARAM);
  const error = url.searchParams.get(LINK_ERROR_PARAM);

  if (!LINK_PARAMS.some((name) => url.searchParams.has(name))) {
    return;
  }

  // `readLinkError` has already turned it into something to show. The
  // service's own description goes to the console, where a developer can read
  // it and a visitor is not asked to trust it.
  if (error) {
    console.warn(
      'The auth service sent this page an error:',
      error,
      url.searchParams.get(LINK_ERROR_DESCRIPTION_PARAM),
    );
  }

  // Off the URL before anything is awaited, whatever happens next. The token
  // is single use, so it will not work on a reload, and a closed tab during
  // the exchange would otherwise leave it in session history. An error goes
  // too, or a reload would report it again. The router is created after this
  // returns, so it starts from the clean address.
  //
  // Handed over whole rather than rebuilt from `pathname`: a link can land on
  // a path like `//evil.example`, which read back as a relative URL names
  // another origin, and `replaceState` throws on that instead of stripping.
  for (const name of LINK_PARAMS) {
    url.searchParams.delete(name);
  }
  window.history.replaceState(window.history.state, '', url);

  if (!token) {
    return;
  }

  // A link may sign in a visitor who is signed out; it may not replace somebody
  // who is already here. Redeeming on sight would let a crafted link swap a
  // signed-in visitor's session for the sender's, and everything they wrote
  // next would land in the sender's account. Checked after a refresh, which
  // drops an expired stored session the auth service rejects, so a dead
  // session does not cost the visitor a link that still works. Not forced
  // with `0`: the SDK keeps a session whose access token is still valid even
  // when the refresh fails, so forcing would only rotate a live token.
  await nhost.refreshSession();

  if (nhost.getUserSession()) {
    return;
  }

  try {
    await nhost.auth.refreshToken({ refreshToken: token });
  } catch (err) {
    // A link that was already opened, or has expired, lands here. There is
    // nothing to recover: the visitor stays signed out and can ask for
    // another one.
    console.error('Could not sign in from that link:', err);
  }
}
