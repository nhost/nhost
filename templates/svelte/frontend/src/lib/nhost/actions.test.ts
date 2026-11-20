import { DEFAULT_SESSION_KEY } from '@nhost/nhost-js/session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inRequest } from '#lib/testing/appServer.ts';
import { isDeleted } from '#lib/testing/requestEvent.ts';
import { signOut } from './actions.remote.ts';
import { PASSWORD_RESET_KEY } from './server.ts';

vi.mock('$app/server', () => import('#lib/testing/appServer.ts'));

const fetchMock = vi.fn<typeof fetch>();

const session = JSON.stringify({
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  decodedToken: { exp: Date.now() + 60 * 60 * 1000 },
  user: { id: 'user-id' },
});

describe('signOut', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deletes the session cookies', async () => {
    const { written } = inRequest({
      cookies: { [DEFAULT_SESSION_KEY]: session, [PASSWORD_RESET_KEY]: '/x' },
    });
    fetchMock.mockResolvedValue(new Response('"OK"', { status: 200 }));

    expect(await signOut()).toEqual({});

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/v1\/signout$/);
    for (const name of [DEFAULT_SESSION_KEY, PASSWORD_RESET_KEY]) {
      expect(isDeleted(written.get(name))).toBe(true);
    }
  });
});
