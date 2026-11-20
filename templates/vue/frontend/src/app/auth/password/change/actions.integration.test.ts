// @vitest-environment happy-dom
import type { Session } from '@nhost/nhost-js/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changePassword } from '@/app/auth/password/change/actions';
import { nhost } from '@/lib/nhost/client';

// The real SDK client, so its storage side effects and its use of the lock
// happen as in the browser. It reads `fetch` when it is built, at import.
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', mock);
  return mock;
});

// One holder at a time and, as in the browser, no way back in for the holder:
// a request made while the lock is held waits for it. The SDK reads
// `navigator.locks` at import, so this has to be in place before it loads.
const locks = vi.hoisted(() => {
  const state = {
    holding: false,
    queue: Promise.resolve() as Promise<unknown>,
  };
  const request = vi.fn((_name: string, ...rest: unknown[]) => {
    const callback = rest.at(-1) as () => Promise<unknown>;
    const run = state.queue.then(async () => {
      state.holding = true;
      try {
        return await callback();
      } finally {
        state.holding = false;
      }
    });
    state.queue = run.catch(() => undefined);
    return run;
  });
  Object.defineProperty(navigator, 'locks', {
    value: { request },
    configurable: true,
  });
  return Object.assign(state, { request });
});

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const base64url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const jwt = (refreshToken: string): string =>
  [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({
      sub: 'user-id',
      session: refreshToken,
      exp: Math.floor(Date.now() / 1000) + 900,
    }),
    'signature',
  ].join('.');

const sessionBody = (refreshToken: string) => ({
  accessToken: jwt(refreshToken),
  accessTokenExpiresIn: 900,
  refreshToken,
  refreshTokenId: `${refreshToken}-id`,
  user: { id: 'user-id', email: 'user@example.com' },
});

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  locks.request.mockClear();
});

describe('changePassword on the real client', () => {
  // The SDK takes the same lock for every request the main client makes, so
  // one made under it would wait for the change to finish, which waits for it.
  it('changes and signs back in under the lock without the main client', async () => {
    nhost.sessionStorage.set(sessionBody('before') as unknown as Session);
    const before = nhost.getUserSession()?.accessToken;
    const spies = (
      [
        'changeUserPassword',
        'signInEmailPassword',
        'verifySignInMfaTotp',
        'refreshToken',
      ] as const
    ).map((name) => vi.spyOn(nhost.auth, name));
    const calls: {
      path: string;
      authorization: string | null;
      held: boolean;
    }[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      const path = new URL(String(input)).pathname;
      calls.push({
        path,
        authorization: new Headers(init?.headers).get('Authorization'),
        held: locks.holding,
      });
      if (path.endsWith('/user/password')) {
        return json('OK', 200);
      }
      if (path.endsWith('/signin/email-password')) {
        return json({ session: sessionBody('after') }, 200);
      }
      return json({ error: 'unexpected' }, 500);
    });

    expect(await changePassword('correct horse')).toEqual({
      success: true,
      signedIn: true,
    });

    expect(calls.map(({ path }) => path)).toEqual([
      '/v1/user/password',
      '/v1/signin/email-password',
    ]);
    expect(calls.every(({ held }) => held)).toBe(true);
    expect(calls[0]?.authorization).toBe(`Bearer ${before}`);
    expect(locks.request).toHaveBeenCalledWith(
      'nhostSessionLock',
      { mode: 'exclusive' },
      expect.any(Function),
    );
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
    expect(nhost.getUserSession()?.refreshToken).toBe('after');
  }, 2_000);

  // The code is checked before the change, and the change goes out with the
  // session the check answered with.
  it('checks a two-factor code under the lock before changing', async () => {
    nhost.sessionStorage.set(sessionBody('before') as unknown as Session);
    const before = nhost.getUserSession()?.accessToken;
    const checked = sessionBody('checked');
    const calls: { path: string; authorization: string | null }[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      const path = new URL(String(input)).pathname;
      expect(locks.holding).toBe(true);
      calls.push({
        path,
        authorization: new Headers(init?.headers).get('Authorization'),
      });
      if (path.endsWith('/elevate/totp')) {
        return json({ session: checked }, 200);
      }
      if (path.endsWith('/user/password')) {
        return json('OK', 200);
      }
      if (path.endsWith('/signin/email-password')) {
        return json({ mfa: { ticket: 'mfaTotp:abc' } }, 200);
      }
      if (path.endsWith('/signin/mfa/totp')) {
        return json({ session: sessionBody('after') }, 200);
      }
      return json({ error: 'unexpected' }, 500);
    });

    expect(await changePassword('correct horse', '123456')).toEqual({
      success: true,
      signedIn: true,
    });

    expect(calls.map(({ path }) => path)).toEqual([
      '/v1/elevate/totp',
      '/v1/user/password',
      '/v1/signin/email-password',
      '/v1/signin/mfa/totp',
    ]);
    expect(calls[0]?.authorization).toBe(`Bearer ${before}`);
    expect(calls[1]?.authorization).toBe(`Bearer ${checked.accessToken}`);
    expect(nhost.getUserSession()?.refreshToken).toBe('after');
  }, 2_000);

  it('changes nothing for a wrong two-factor code', async () => {
    nhost.sessionStorage.set(sessionBody('before') as unknown as Session);
    const paths: string[] = [];
    fetchMock.mockImplementation(async (input) => {
      paths.push(new URL(String(input)).pathname);
      return json({ error: 'invalid-totp', status: 401 }, 401);
    });

    expect((await changePassword('correct horse', '000000')).error).toMatch(
      /password was not changed/,
    );

    expect(paths).toEqual(['/v1/elevate/totp']);
    expect(nhost.getUserSession()?.refreshToken).toBe('before');
  }, 2_000);
});
