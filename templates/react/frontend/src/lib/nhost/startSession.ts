import {
  bareAuth,
  checkSession,
  LINK_TOKEN_PARAM,
  LINK_TYPE_PARAM,
  nhost,
  revokeLinkToken,
} from './client';
import {
  endPasswordReset,
  PASSWORD_RESET_LINK_TYPE,
  startPasswordReset,
} from './passwordReset';

// How close to expiry startup refreshes the access token, so the first page
// does not have to.
const START_REFRESH_MARGIN_SECONDS = 60;

let started: Promise<void> | undefined;

/**
 * Settles the session before the first render: refreshes it, drops it if it was
 * revoked elsewhere, and handles a link token in the address bar. Runs once per
 * page load, however often it is called, and never rejects.
 */
export function startSession(): Promise<void> {
  started ??= run();
  return started;
}

// A refresh token has no business staying in the address bar: query strings
// leak through history, bookmarks and the referer header. Stripped whether or
// not it is redeemed, before anything else can read or log the URL.
function takeLinkToken(): { token: string | null; type: string | null } {
  const url = new URL(window.location.href);
  const token = url.searchParams.get(LINK_TOKEN_PARAM);
  const type = url.searchParams.get(LINK_TYPE_PARAM);

  if (token !== null) {
    url.searchParams.delete(LINK_TOKEN_PARAM);
    url.searchParams.delete(LINK_TYPE_PARAM);
    window.history.replaceState(window.history.state, '', url);
  }

  return { token, type };
}

async function run(): Promise<void> {
  try {
    const page = window.location.pathname;
    const link = takeLinkToken();

    // Signs out on a 401 and keeps the session on any other failure.
    await nhost.refreshSession(START_REFRESH_MARGIN_SECONDS);

    // A session revoked from elsewhere, by a password change or from another
    // device's account page, still holds an access token the backend accepts
    // until it expires.
    const session = nhost.getUserSession();
    if (session && (await checkSession(session)) === 'revoked') {
      // Unless another tab signed in again meanwhile.
      if (nhost.getUserSession()?.refreshTokenId === session.refreshTokenId) {
        nhost.sessionStorage.remove();
      }
    }

    const signedIn = !!nhost.getUserSession();
    if (!signedIn) {
      endPasswordReset();
    }

    if (link.token === null) {
      return;
    }

    // A link may sign in a visitor who is signed out; it may not replace
    // somebody who is already here, and the session it carries is revoked
    // instead.
    if (signedIn) {
      await revokeLinkToken(link.token);
      return;
    }

    await redeemLinkToken(
      link.token,
      link.type === PASSWORD_RESET_LINK_TYPE ? page : null,
    );
  } catch (err) {
    console.error('Could not start the session:', err);
  }
}

async function redeemLinkToken(
  token: string,
  resetPage: string | null,
): Promise<void> {
  try {
    // The bare client, so the session is stored only after the reset marker:
    // other tabs follow the session as soon as it lands.
    const { body } = await bareAuth().refreshToken({ refreshToken: token });

    if (resetPage) {
      startPasswordReset(resetPage);
    }
    // Goes through sessionStorage rather than storage directly so the access
    // token is decoded into the stored shape the app reads.
    nhost.sessionStorage.set(body);
  } catch (err) {
    // An expired or already-used link is normal; the page handles an anonymous
    // visitor.
    console.error('Could not redeem the link token:', err);
    if (!nhost.getUserSession()) {
      endPasswordReset();
    }
  }
}
