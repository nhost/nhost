import { describe, expect, it, jest } from '@jest/globals';
import type { Client as AuthClient, Session as AuthSession } from '../../auth';
import { refreshSession } from '../refreshSession';
import { SessionStorage } from '../storage';
import { MemoryStorage } from '../storageBackend';

function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createSession(expiresInSeconds: number, role: string): AuthSession {
  const payload = {
    sub: 'user-123',
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    'https://hasura.io/jwt/claims': {
      'x-hasura-user-id': 'user-123',
      'x-hasura-default-role': 'user',
      'x-hasura-allowed-roles': `{user,${role}}`,
    },
  };
  return {
    accessToken: `${toBase64Url('{"alg":"HS256"}')}.${toBase64Url(JSON.stringify(payload))}.signature`,
    accessTokenExpiresIn: expiresInSeconds,
    refreshToken: `refresh-${role}`,
    refreshTokenId: `refresh-id-${role}`,
    user: { id: 'user-123' } as AuthSession['user'],
  };
}

function createAuth(refreshed: AuthSession) {
  const refreshToken = jest.fn(async () => ({
    body: refreshed,
    status: 200,
    headers: new Headers(),
  }));
  return { auth: { refreshToken } as unknown as AuthClient, refreshToken };
}

describe('refreshSession', () => {
  it('returns the stored session when no refresh is needed', async () => {
    const storage = new SessionStorage(new MemoryStorage());
    storage.set(createSession(3600, 'user'));
    const { auth, refreshToken } = createAuth(createSession(3600, 'admin'));

    const session = await refreshSession(auth, storage, 60);

    expect(refreshToken).not.toHaveBeenCalled();
    expect(session).toBe(storage.get());
  });

  it('returns the refreshed session with its decoded token', async () => {
    const storage = new SessionStorage(new MemoryStorage());
    storage.set(createSession(30, 'user'));
    const { auth, refreshToken } = createAuth(createSession(900, 'admin'));

    const session = await refreshSession(auth, storage, 60);

    expect(refreshToken).toHaveBeenCalledWith({ refreshToken: 'refresh-user' });
    expect(session).toEqual(storage.get());
    expect(session?.refreshToken).toBe('refresh-admin');
    expect(
      session?.decodedToken['https://hasura.io/jwt/claims']?.[
        'x-hasura-allowed-roles'
      ],
    ).toEqual(['user', 'admin']);
  });
});
