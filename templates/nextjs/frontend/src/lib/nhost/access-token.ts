import type { DecodedToken, StoredSession } from '@nhost/nhost-js/session';

// The browser's copy of the session: the access token and its decoded claims,
// nothing else. The proxy and server actions write it next to the httpOnly
// session cookie, through `sessionCookies` in `server.ts`, and `client.ts`
// reads it. It is kept free of anything server-only so the browser client
// can import it.
export const ACCESS_TOKEN_KEY = 'nhostAccessToken';

type AccessTokenCookie = Pick<StoredSession, 'accessToken' | 'decodedToken'>;

// `decodedToken.exp` is in milliseconds: the SDK converts it when it decodes.
export function secondsUntilExpiry(decodedToken: DecodedToken): number {
  return Math.max(0, Math.floor(((decodedToken.exp ?? 0) - Date.now()) / 1000));
}

export function serializeAccessTokenCookie(session: StoredSession): string {
  const cookie: AccessTokenCookie = {
    accessToken: session.accessToken,
    decodedToken: session.decodedToken,
  };

  return JSON.stringify(cookie);
}

/**
 * Finds the access-token cookie in a `document.cookie` string and returns it
 * in the shape the SDK's session storage expects.
 *
 * The refresh token fields are empty because the browser never has one. That
 * is enough for the client in `client.ts`, which only attaches the access token
 * to requests, and it means a caller that reaches for `refreshToken` gets
 * nothing usable rather than a credential.
 */
export function readAccessTokenCookie(
  cookieString: string,
): StoredSession | null {
  const prefix = `${ACCESS_TOKEN_KEY}=`;
  const raw = cookieString
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);

  if (!raw) {
    return null;
  }

  try {
    const { accessToken, decodedToken } = JSON.parse(
      decodeURIComponent(raw),
    ) as AccessTokenCookie;

    if (!accessToken || !decodedToken) {
      return null;
    }

    return {
      accessToken,
      accessTokenExpiresIn: secondsUntilExpiry(decodedToken),
      decodedToken,
      refreshToken: '',
      refreshTokenId: '',
    };
  } catch {
    return null;
  }
}
