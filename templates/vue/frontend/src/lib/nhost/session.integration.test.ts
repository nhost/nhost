// @vitest-environment happy-dom
import { DEFAULT_SESSION_KEY } from '@nhost/nhost-js/session';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real SDK client, so its storage side effects happen as in the browser.
// It reads `fetch` when it is built, at import.
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', mock);
  return mock;
});

const MARKER = 'nhostPasswordReset';

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const base64url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const jwt = (lifetimeSeconds: number): string =>
  [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({
      sub: 'user-id',
      exp: Math.floor(Date.now() / 1000) + lifetimeSeconds,
    }),
    'signature',
  ].join('.');

const fromLink = () =>
  json(
    {
      accessToken: jwt(900),
      accessTokenExpiresIn: 900,
      refreshToken: 'session-from-link',
      refreshTokenId: 'refresh-token-id',
      user: { id: 'user-id' },
    },
    200,
  );

async function load(url: string) {
  window.history.replaceState(null, '', url);
  vi.resetModules();
  const { nhost } = await import('@/lib/nhost/client');
  const { startSession } = await import('@/lib/nhost/startSession');
  return { nhost, startSession };
}

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
});

describe('startSession on the real client', () => {
  // Other tabs follow the session the moment it is stored, so the marker has
  // to be there first or they would see a session free to go anywhere.
  it('writes the reset marker before the session it confines', async () => {
    const { nhost, startSession } = await load(
      '/auth/password/reset?refreshToken=link-token&type=passwordReset',
    );
    const mainRefresh = vi.spyOn(nhost.auth, 'refreshToken');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    let markerWhenStored: string | null = null;
    nhost.sessionStorage.onChange(() => {
      markerWhenStored = localStorage.getItem(MARKER);
    });
    fetchMock.mockImplementation(async () => fromLink());

    await startSession();

    expect(markerWhenStored).toBe('/auth/password/reset');
    expect(setItem.mock.calls.map(([key]) => key)).toEqual([
      MARKER,
      DEFAULT_SESSION_KEY,
    ]);
    expect(mainRefresh).not.toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/v1\/token$/);
    expect(nhost.getUserSession()?.refreshToken).toBe('session-from-link');
    expect(window.location.search).toBe('');
  });
});
