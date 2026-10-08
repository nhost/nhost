import type { NhostClient } from '@nhost/nhost-js';

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
  const query = url.split('?')[1];

  if (!query) {
    return null;
  }

  return new URLSearchParams(query).get(LINK_TOKEN_PARAM);
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
