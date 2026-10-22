import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Client as AuthClient } from '../../auth';
import { FetchError } from '../../fetch';
import { refreshSession } from '../refreshSession';
import type { StoredSession } from '../session';
import { SessionStorage } from '../storage';

const NOW = 1_700_000_000_000;

const makeStorage = (expiresInMs: number) => {
  let stored: StoredSession | null = {
    accessToken: 'access-token',
    accessTokenExpiresIn: 900,
    refreshToken: 'refresh-token',
    refreshTokenId: 'refresh-token-id',
    decodedToken: { exp: NOW + expiresInMs },
  } as StoredSession;

  return new SessionStorage({
    get: () => stored,
    set: (value) => {
      stored = value;
    },
    remove: () => {
      stored = null;
    },
  });
};

const makeAuth = (...errors: FetchError[]) => {
  const refreshToken = jest.fn<() => Promise<never>>();
  for (const error of errors) {
    refreshToken.mockRejectedValueOnce(error);
  }
  refreshToken.mockRejectedValue(new FetchError({}, 500, new Headers()));

  return {
    auth: { refreshToken } as unknown as AuthClient,
    refreshToken,
  };
};

const rateLimited = (retryAfter: string) =>
  new FetchError({}, 429, new Headers({ 'Retry-After': retryAfter }));

const at = (ms: number) => jest.spyOn(Date, 'now').mockReturnValue(NOW + ms);

describe('refreshSession with Retry-After', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('waits for Retry-After instead of retrying when the session has expired', async () => {
    const storage = makeStorage(-1000);
    const { auth, refreshToken } = makeAuth(rateLimited('30'));

    at(0);
    expect(await refreshSession(auth, storage)).toBeNull();
    expect(refreshToken).toHaveBeenCalledTimes(1);

    at(29_999);
    expect(await refreshSession(auth, storage)).toBeNull();
    expect(refreshToken).toHaveBeenCalledTimes(1);

    at(30_000);
    await refreshSession(auth, storage);
    expect(refreshToken.mock.calls.length).toBeGreaterThan(1);
  });

  it('keeps the current session and skips calls while waiting', async () => {
    const storage = makeStorage(30_000);
    const session = storage.get();
    const { auth, refreshToken } = makeAuth(rateLimited('30'));

    at(0);
    expect(await refreshSession(auth, storage)).toBe(session);

    at(10_000);
    expect(await refreshSession(auth, storage)).toBe(session);
    expect(refreshToken).toHaveBeenCalledTimes(1);
  });

  it('accepts Retry-After as an HTTP date', async () => {
    const storage = makeStorage(-1000);
    const retryAt = new Date(NOW + 20_000).toUTCString();
    const { auth, refreshToken } = makeAuth(rateLimited(retryAt));

    at(0);
    await refreshSession(auth, storage);

    at(19_000);
    await refreshSession(auth, storage);
    expect(refreshToken).toHaveBeenCalledTimes(1);

    at(20_000);
    await refreshSession(auth, storage);
    expect(refreshToken.mock.calls.length).toBeGreaterThan(1);
  });

  it('still retries right away when there is no Retry-After', async () => {
    const storage = makeStorage(-1000);
    const { auth, refreshToken } = makeAuth(
      new FetchError({}, 429, new Headers()),
    );

    at(0);
    expect(await refreshSession(auth, storage)).toBeNull();
    expect(refreshToken).toHaveBeenCalledTimes(2);
  });
});
