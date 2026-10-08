import type { NhostClient } from '@nhost/nhost-js';
import type { ErrorResponseError } from '@nhost/nhost-js/auth';

/**
 * The query parameter the auth service puts a refresh token in when it sends
 * the user back here: the magic link, the email verification link, the
 * password reset link and the OAuth callback all arrive this way.
 */
export const LINK_TOKEN_PARAM = 'refreshToken';

/**
 * Reads the token out of a deep link, or null when the link carries none.
 *
 * A deep link is not a web URL and does not always parse as one: under Expo Go
 * it looks like `exp://10.0.0.2:8081/--/auth/callback?refreshToken=...`, and in
 * a real build like `nhoststarter:///auth/callback?refreshToken=...`. What is
 * wanted is only the query, so this takes the part after the first `?` rather
 * than handing the whole thing to a URL parser that reads the scheme
 * differently on each platform.
 */
export function linkToken(url: string): string | null {
  return linkParams(url).get(LINK_TOKEN_PARAM);
}

function linkParams(url: string): URLSearchParams {
  return new URLSearchParams(url.split('?')[1] ?? '');
}

/**
 * What the auth service sends back instead of a token when the link failed: a
 * provider that is not enabled or refused the sign-in, or an email link that
 * expired or was already used. `error` is a code, and `errorDescription` is
 * the service's sentence for it.
 */
const LINK_ERROR_PARAM = 'error';
const LINK_ERROR_DESCRIPTION_PARAM = 'errorDescription';

// The user is told this app's own sentence, never `errorDescription`. Any web
// page or app can open the scheme with whatever description it likes, and
// showing it would let the sender put their words in this app. The codes the
// service sends have fixed descriptions anyway, so nothing is lost.
//
// A `Map`, not an object: the code comes off the link, and `error=__proto__`
// or `error=toString` would find what every object inherits, which React
// refuses to render or prints as a function's source.
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
 * What to tell the user when a deep link carries an error from the auth
 * service rather than a token, or null when it does not.
 *
 * The service's own description goes to the console, where a developer can
 * read it and a user is not asked to trust it.
 */
export function readLinkError(url: string): string | null {
  const params = linkParams(url);
  const code = params.get(LINK_ERROR_PARAM);

  if (!code) {
    return null;
  }

  console.warn(
    'The auth service sent this app an error:',
    code,
    params.get(LINK_ERROR_DESCRIPTION_PARAM),
  );

  return linkErrorMessage(code);
}

const redemptions = new WeakMap<NhostClient, Promise<void>>();

/**
 * Turns a token from a deep link into a stored session.
 *
 * Exchanging it goes through the client's own middleware, which writes the
 * session to storage, so there is nothing to persist by hand. It is single
 * use: a link that was already opened, or has expired, fails here and leaves
 * the user signed out with nothing to recover but asking for another one.
 *
 * Calls with the same client run one after another. The OAuth screen redeems
 * the callback it is handed, and on Android the same callback can also arrive
 * as a link event; run side by side, both would pass the signed-in check below
 * before either had a session, and the second would spend a used token.
 */
export function redeemLinkToken(
  nhost: NhostClient,
  url: string,
): Promise<void> {
  const run = () => redeem(nhost, url);
  const redemption = (redemptions.get(nhost) ?? Promise.resolve()).then(
    run,
    run,
  );

  redemptions.set(nhost, redemption);

  return redemption;
}

async function redeem(nhost: NhostClient, url: string): Promise<void> {
  const token = linkToken(url);

  if (!token) {
    return;
  }

  // A link may sign in a user who is signed out; it may not replace somebody
  // who is already here. The app's scheme can be opened by any web page or
  // app, so redeeming on sight would let a crafted link swap a signed-in
  // user's session for the sender's, and everything they saved next would
  // land in the sender's account. Checked after a refresh, which drops a
  // stored session the auth service rejects, so a dead session does not cost
  // the user a link that still works. This relies on `startAuth` having read
  // the stored session first; before that, memory is empty and the check
  // would pass anyone.
  await nhost.refreshSession();

  if (nhost.getUserSession()) {
    return;
  }

  try {
    await nhost.auth.refreshToken({ refreshToken: token });
  } catch (err) {
    console.error('Could not sign in from that link:', err);
  }
}
