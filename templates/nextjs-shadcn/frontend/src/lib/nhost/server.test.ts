import { CookieStorage, type StoredSession } from '@nhost/nhost-js/session';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeSessionCookie, encodeSessionCookie } from '@/lib/nhost/server';

const session: StoredSession = {
  accessToken: 'header.payload.signature',
  accessTokenExpiresIn: 900,
  refreshTokenId: 'refresh-token-id',
  refreshToken: 'refresh token;/☃',
  decodedToken: {
    sub: 'user-id',
    'https://hasura.io/jwt/claims': {
      'x-hasura-user-id': 'user-id',
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Nhost session cookie serialization', () => {
  it('reads a cookie written by the SDK CookieStorage', () => {
    const documentStub = { cookie: '' };
    vi.stubGlobal('document', documentStub);

    new CookieStorage({ secure: false }).set(session);

    const raw = documentStub.cookie
      .split(';', 1)[0]
      ?.slice('nhostSession='.length);

    expect(decodeSessionCookie(raw ?? null)).toEqual(session);
  });

  it('writes a cookie read by the SDK CookieStorage', () => {
    vi.stubGlobal('document', {
      cookie: `nhostSession=${encodeSessionCookie(session)}`,
    });

    expect(new CookieStorage({ secure: false }).get()).toEqual(session);
  });

  it('returns null for malformed cookies', () => {
    expect(decodeSessionCookie('%E0%A4%A')).toBeNull();
    expect(decodeSessionCookie('not-json')).toBeNull();
  });
});
