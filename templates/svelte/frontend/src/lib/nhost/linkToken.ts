import type { NhostClient } from '@nhost/nhost-js';

/**
 * The query parameter the auth service puts a refresh token in when it sends
 * the browser back here: the magic link, the email verification link, the
 * password reset link and the OAuth callback all arrive this way.
 */
export const LINK_TOKEN_PARAM = 'refreshToken';

/**
 * Turns the token on the URL into a stored session, and takes it off the URL.
 *
 * In an app with a server this is the server's job, because the token can be
 * redeemed once and a page that renders twice would burn it. Here there is no
 * server, so it happens once on startup, before anything reads the session.
 *
 * Exchanging it goes through the client's own middleware, which writes the
 * session to storage, so there is nothing to persist by hand.
 */
export async function redeemLinkToken(nhost: NhostClient): Promise<void> {
  // `URLSearchParams` rather than `new URL`: it reads the part of the address
  // this cares about and has no malformed input to throw on.
  const params = new URLSearchParams(window.location.search);
  const token = params.get(LINK_TOKEN_PARAM);

  if (!token) {
    return;
  }

  try {
    await nhost.auth.refreshToken({ refreshToken: token });
  } catch (err) {
    // A link that was already opened, or has expired, lands here. There is
    // nothing to recover: the visitor stays signed out and can ask for
    // another one.
    console.error('Could not sign in from that link:', err);
  } finally {
    // Off the URL either way. It is single use, so it will not work on a
    // reload, and leaving it in the address bar puts it in browser history
    // and in the `Referer` of anything this page loads next.
    params.delete(LINK_TOKEN_PARAM);

    const query = params.toString();
    const { pathname, hash } = window.location;

    window.history.replaceState(
      null,
      '',
      `${pathname}${query ? `?${query}` : ''}${hash}`,
    );
  }
}
