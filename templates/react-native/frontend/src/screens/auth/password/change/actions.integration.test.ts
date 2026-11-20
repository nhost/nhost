import type { Session } from '@nhost/nhost-js/auth';
import { json, jwt } from '@/test/session';

type ClientModule = typeof import('@/lib/nhost/client');
type ActionsModule = typeof import('@/screens/auth/password/change/actions');

// The real SDK client on the in-process lock `lib/polyfills.ts` installs, so
// its storage side effects and its use of the lock happen as on a device. It
// reads `fetch` when it is built, so the stub goes in before it is required.
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
global.fetch = fetchMock as typeof fetch;

const { nhost } = require('@/lib/nhost/client') as ClientModule;
const { changePassword } =
  require('@/screens/auth/password/change/actions') as ActionsModule;

// Whether a callback holds the SDK's lock exclusively right now. The calls
// still go to the real lock, which the SDK uses too.
const lock = { exclusive: false };
const request = navigator.locks.request.bind(navigator.locks);

const sessionBody = (refreshToken: string) => ({
  accessToken: jwt(900, { session: refreshToken }),
  accessTokenExpiresIn: 900,
  refreshToken,
  refreshTokenId: `${refreshToken}-id`,
  user: { id: 'user-id', email: 'user@example.com' },
});

const pathOf = (input: Parameters<typeof fetch>[0]): string =>
  String(input).replace(/^https:\/\/[^/]+/, '');

// Main-client methods the change must not use while it holds the lock.
const MAIN_CLIENT = [
  'changeUserPassword',
  'signInEmailPassword',
  'verifySignInMfaTotp',
  'refreshToken',
] as const;
let mainClient: jest.SpyInstance[] = [];

beforeEach(() => {
  fetchMock.mockReset();
  mainClient = MAIN_CLIENT.map((name) => jest.spyOn(nhost.auth, name));
  jest
    .spyOn(navigator.locks, 'request')
    .mockImplementation((name, options, callback) =>
      request(name, options, async (held) => {
        const exclusive = options.mode !== 'shared';
        lock.exclusive ||= exclusive;
        try {
          return await callback(held);
        } finally {
          if (exclusive) {
            lock.exclusive = false;
          }
        }
      }),
    );
  nhost.sessionStorage.set(sessionBody('before') as unknown as Session);
});

afterEach(() => {
  for (const spy of mainClient) {
    expect(spy).not.toHaveBeenCalled();
  }
  jest.restoreAllMocks();
});

// The SDK takes the same lock, shared, before a main-client request that uses
// the stored session, and the lock does not re-enter: such a call under the
// exclusive hold waits for the hold to end, which waits for the call, and the
// test times out. A call that brings its own Authorization header skips the
// lock, so the spies above catch any main-client call instead.
describe('changePassword on the real client and lock', () => {
  it('changes and signs back in under the lock without the main client', async () => {
    const before = nhost.getUserSession()?.accessToken;
    const calls: {
      path: string;
      authorization: string | null;
      held: boolean;
    }[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      const path = pathOf(input);
      calls.push({
        path,
        authorization: new Headers(init?.headers).get('Authorization'),
        held: lock.exclusive,
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
    expect(navigator.locks.request).toHaveBeenCalledWith(
      'nhostSessionLock',
      { mode: 'exclusive' },
      expect.any(Function),
    );
    expect(nhost.getUserSession()?.refreshToken).toBe('after');
  }, 2_000);

  // The code is checked before the change, and the change goes out with the
  // session the check answered with.
  it('checks a two-factor code under the lock before changing', async () => {
    const before = nhost.getUserSession()?.accessToken;
    const checked = sessionBody('checked');
    const calls: { path: string; authorization: string | null }[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      const path = pathOf(input);
      expect(lock.exclusive).toBe(true);
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
    const paths: string[] = [];
    fetchMock.mockImplementation(async (input) => {
      paths.push(pathOf(input));
      return json({ error: 'invalid-totp', status: 401 }, 401);
    });

    expect((await changePassword('correct horse', '000000')).error).toMatch(
      /password was not changed/,
    );

    expect(paths).toEqual(['/v1/elevate/totp']);
    expect(nhost.getUserSession()?.refreshToken).toBe('before');
  }, 2_000);

  // What the tests above rely on: a main-client call under the hold waits
  // for the hold to end.
  it('holds back a main-client call made under it until it ends', async () => {
    fetchMock.mockImplementation(async () => json({ id: 'user-id' }, 200));
    let call: Promise<unknown> | undefined;

    const outcome = await navigator.locks.request(
      'nhostSessionLock',
      { mode: 'exclusive' },
      async () => {
        call = nhost.auth.getUser();
        return await Promise.race([
          call.then(() => 'answered'),
          new Promise((resolve) => setTimeout(resolve, 200, 'waiting')),
        ]);
      },
    );

    expect(outcome).toBe('waiting');
    await expect(call).resolves.toMatchObject({ body: { id: 'user-id' } });
  });
});
