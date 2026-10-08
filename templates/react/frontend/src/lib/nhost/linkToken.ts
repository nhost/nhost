import type { NhostClient } from '@nhost/nhost-js';

/**
 * The query parameter the auth service puts a refresh token in when it sends
 * the browser back here: the magic link, the email verification link, the
 * password reset link and the OAuth callback all arrive this way.
 */
export const LINK_TOKEN_PARAM = 'refreshToken';

const redemptions = new WeakMap<NhostClient, Promise<void>>();

/**
 * Whether this page load arrived with a token to redeem, and so does not yet
 * know who the visitor is.
 */
export function hasLinkToken(): boolean {
  return Boolean(
    new URLSearchParams(window.location.search).get(LINK_TOKEN_PARAM),
  );
}

/**
 * Turns the token on the URL into a stored session, and takes it off the URL.
 *
 * In an app with a server this is the server's job, because the token can be
 * redeemed once and a page that renders twice would burn it. Here there is no
 * server, so it happens once on startup, before anything reads the session.
 *
 * Every call with the same client gets the first call's promise. StrictMode
 * runs `AuthProvider`'s effect twice in development, and the second run has to
 * wait for the exchange the first one started, not find the URL already clean
 * and render the visitor signed out while it is still in flight.
 *
 * Exchanging it goes through the client's own middleware, which writes the
 * session to storage, so there is nothing to persist by hand.
 */
export function redeemLinkToken(nhost: NhostClient): Promise<void> {
  let redemption = redemptions.get(nhost);

  if (!redemption) {
    redemption = redeem(nhost);
    redemptions.set(nhost, redemption);
  }

  return redemption;
}

async function redeem(nhost: NhostClient): Promise<void> {
  // `URLSearchParams` rather than `new URL`: it reads the part of the address
  // this cares about and has no malformed input to throw on.
  const params = new URLSearchParams(window.location.search);
  const token = params.get(LINK_TOKEN_PARAM);

  if (!token) {
    return;
  }

  // Off the URL before anything is awaited, whatever happens next. It is
  // single use, so it will not work on a reload, and a navigation or a closed
  // tab during the exchange would otherwise leave it in session history.
  // `history.state` is passed on because React Router keeps its place there.
  params.delete(LINK_TOKEN_PARAM);

  const query = params.toString();
  const { pathname, hash } = window.location;

  window.history.replaceState(
    window.history.state,
    '',
    `${pathname}${query ? `?${query}` : ''}${hash}`,
  );

  // A link may sign in a visitor who is signed out; it may not replace somebody
  // who is already here. Redeeming on sight would let a crafted link swap a
  // signed-in visitor's session for the sender's, and everything they wrote
  // next would land in the sender's account. Checked after a refresh, which
  // drops a stored session the auth service rejects, so a dead session does
  // not cost the visitor a link that still works.
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
