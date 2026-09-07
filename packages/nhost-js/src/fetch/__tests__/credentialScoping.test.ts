import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { Session } from '../../auth';
import type { SessionStorage, StoredSession } from '../../session/storage';
import { attachAccessTokenMiddleware } from '../middlewareAttachAccessToken';
import { withAdminSessionMiddleware } from '../middlewareWithAdminSession';

const ACCESS_TOKEN = 'stored-access-token';

/**
 * Minimal storage stub: the middleware only ever calls get().
 */
const storageWith = (accessToken: string | null): SessionStorage =>
  ({
    get: () =>
      accessToken === null
        ? null
        : ({ accessToken, refreshToken: 'r' } as unknown as StoredSession),
    set: () => undefined,
    remove: () => undefined,
    onChange: () => () => undefined,
  }) as unknown as SessionStorage;

/**
 * Runs one request through a middleware and reports the headers that reached
 * the terminal fetch.
 */
const headersSeenBy = async (
  middleware: ReturnType<typeof attachAccessTokenMiddleware>,
  url: string,
  options: RequestInit = {},
): Promise<Headers> => {
  let seen = new Headers();
  const terminal = async (_url: string, opts: RequestInit = {}) => {
    seen = new Headers(opts.headers || {});
    return new Response('{}', { status: 200 });
  };
  await middleware(terminal)(url, options);
  return seen;
};

describe('attachAccessTokenMiddleware origin scoping', () => {
  const SERVICE = 'https://graphql.example/v1';

  test('attaches the stored token inside the service origin', async () => {
    const mw = attachAccessTokenMiddleware(storageWith(ACCESS_TOKEN), SERVICE);
    const headers = await headersSeenBy(mw, 'https://graphql.example/v1');
    expect(headers.get('Authorization')).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  test('does not attach the token outside the service origin', async () => {
    const mw = attachAccessTokenMiddleware(storageWith(ACCESS_TOKEN), SERVICE);
    const headers = await headersSeenBy(mw, 'https://evil.example/v1');
    expect(headers.get('Authorization')).toBeNull();
  });

  test('strips the stored token when the request has left the origin', async () => {
    const mw = attachAccessTokenMiddleware(storageWith(ACCESS_TOKEN), SERVICE);
    const headers = await headersSeenBy(mw, 'https://evil.example/v1', {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    expect(headers.get('Authorization')).toBeNull();
  });

  test('preserves an unrelated Authorization value off-origin', async () => {
    const mw = attachAccessTokenMiddleware(storageWith(ACCESS_TOKEN), SERVICE);
    const headers = await headersSeenBy(mw, 'https://third-party.example/v1', {
      headers: { Authorization: 'Bearer someone-elses-token' },
    });
    expect(headers.get('Authorization')).toBe('Bearer someone-elses-token');
  });

  test('lets a caller-supplied Authorization win inside the origin', async () => {
    const mw = attachAccessTokenMiddleware(storageWith(ACCESS_TOKEN), SERVICE);
    const headers = await headersSeenBy(mw, 'https://graphql.example/v1', {
      headers: { Authorization: 'Bearer explicit' },
    });
    expect(headers.get('Authorization')).toBe('Bearer explicit');
  });

  test('does nothing when there is no stored session', async () => {
    const mw = attachAccessTokenMiddleware(storageWith(null), SERVICE);
    const headers = await headersSeenBy(mw, 'https://graphql.example/v1');
    expect(headers.get('Authorization')).toBeNull();
  });
});

describe('withAdminSessionMiddleware origin and transport scoping', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  test('attaches the admin secret over HTTPS inside the origin', async () => {
    const mw = withAdminSessionMiddleware(
      { adminSecret: 'super-secret' },
      'https://storage.example/v1',
    );
    const headers = await headersSeenBy(mw, 'https://storage.example/v1/files');
    expect(headers.get('x-hasura-admin-secret')).toBe('super-secret');
  });

  test('withholds the admin secret outside the service origin', async () => {
    const mw = withAdminSessionMiddleware(
      { adminSecret: 'super-secret' },
      'https://storage.example/v1',
    );
    const headers = await headersSeenBy(mw, 'https://evil.example/v1/files');
    expect(headers.get('x-hasura-admin-secret')).toBeNull();
  });

  test('withholds the admin secret over cleartext to a non-loopback host', async () => {
    const mw = withAdminSessionMiddleware(
      { adminSecret: 'super-secret' },
      'http://storage.example/v1',
    );
    const headers = await headersSeenBy(mw, 'http://storage.example/v1/files');
    expect(headers.get('x-hasura-admin-secret')).toBeNull();
  });

  test('permits cleartext to loopback', async () => {
    const mw = withAdminSessionMiddleware(
      { adminSecret: 'super-secret' },
      'http://localhost:1337/v1/storage',
    );
    const headers = await headersSeenBy(
      mw,
      'http://localhost:1337/v1/storage/files',
    );
    expect(headers.get('x-hasura-admin-secret')).toBe('super-secret');
  });

  test('permits cleartext with an explicit opt-in', async () => {
    const mw = withAdminSessionMiddleware(
      { adminSecret: 'super-secret', allowInsecureHttp: true },
      'http://storage.example/v1',
    );
    const headers = await headersSeenBy(mw, 'http://storage.example/v1/files');
    expect(headers.get('x-hasura-admin-secret')).toBe('super-secret');
  });

  test('withholds role and session variables together with the secret', async () => {
    const mw = withAdminSessionMiddleware(
      {
        adminSecret: 'super-secret',
        role: 'admin',
        sessionVariables: { 'user-id': '123' },
      },
      'https://storage.example/v1',
    );
    const headers = await headersSeenBy(mw, 'https://evil.example/v1/files');
    expect(headers.get('x-hasura-admin-secret')).toBeNull();
    expect(headers.get('x-hasura-role')).toBeNull();
    expect(headers.get('x-hasura-user-id')).toBeNull();
  });
});

describe('sessionRefreshMiddleware token endpoint detection', () => {
  /**
   * Builds the refresh middleware with a stubbed auth client, and reports
   * whether a refresh was attempted for a given request URL.
   */
  const refreshAttemptedFor = async (
    authBaseUrl: string,
    requestUrl: string,
  ): Promise<boolean> => {
    jest.resetModules();
    let refreshed = false;
    jest.doMock('../../session/refreshSession', () => ({
      refreshSession: async () => {
        refreshed = true;
        return null as unknown as Session;
      },
    }));
    const { sessionRefreshMiddleware } = await import(
      '../middlewareSessionRefresh'
    );
    const mw = sessionRefreshMiddleware(
      { baseURL: authBaseUrl } as never,
      storageWith(ACCESS_TOKEN),
    );
    const terminal = async () => new Response('{}', { status: 200 });
    await mw(terminal)(requestUrl, {});
    return refreshed;
  };

  test('skips the auth service token endpoint', async () => {
    await expect(
      refreshAttemptedFor(
        'https://auth.example/v1',
        'https://auth.example/v1/token',
      ),
    ).resolves.toBe(false);
  });

  test('honours a non-/v1 auth path prefix', async () => {
    await expect(
      refreshAttemptedFor(
        'http://localhost:1337/v1/auth',
        'http://localhost:1337/v1/auth/token',
      ),
    ).resolves.toBe(false);
  });

  test('still refreshes for another service whose path ends in /token', async () => {
    await expect(
      refreshAttemptedFor(
        'https://auth.example/v1',
        'https://functions.example/v1/token',
      ),
    ).resolves.toBe(true);
  });

  test('still refreshes for a non-token auth path', async () => {
    await expect(
      refreshAttemptedFor(
        'https://auth.example/v1',
        'https://auth.example/v1/user',
      ),
    ).resolves.toBe(true);
  });
});
