import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { createClient } from '../../nhost';

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const binaryString = Array.from(bytes, (b) => String.fromCharCode(b)).join(
    '',
  );
  return btoa(binaryString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createJWT(payload: Record<string, unknown>): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url('fake-signature');
  return `${header}.${body}.${signature}`;
}

const userId = 'db477732-48fa-4289-b694-2886a646b6eb';

function createSession(accessToken: string) {
  return {
    accessToken,
    accessTokenExpiresIn: 900,
    refreshTokenId: '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24',
    refreshToken: 'a1b2c3d4-c4b9-48e3-978a-d4d0f1d42e24',
  };
}

function createAccessToken(expSeconds: number): string {
  return createJWT({
    sub: userId,
    iat: expSeconds - 900,
    exp: expSeconds,
    iss: 'hasura-auth',
    'https://hasura.io/jwt/claims': {
      'x-hasura-user-id': userId,
      'x-hasura-default-role': 'user',
      'x-hasura-allowed-roles': '{user}',
    },
  });
}

const nowSeconds = Math.floor(Date.now() / 1000);
const expiredAccessToken = createAccessToken(nowSeconds - 60);
const refreshedAccessToken = createAccessToken(nowSeconds + 900);

// A recursive refresh never resolves (it deadlocks on navigator.locks or loops
// forever without one), so race the request against a short timer to fail
// with a clear message instead of jest's generic timeout.
async function withinTimeout<T>(promise: Promise<T>, ms = 1000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`request did not complete within ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const mockFetch = jest.fn<typeof fetch>();
const originalFetch = global.fetch;

describe('session refresh middleware', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/token') && init?.method === 'POST') {
        return new Response(
          JSON.stringify(createSession(refreshedAccessToken)),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test.each([
    {
      name: 'default /v1 url',
      options: { subdomain: 'local', region: 'local' },
    },
    {
      name: 'custom url without /v1',
      options: { authUrl: 'https://auth.example.com' },
    },
    {
      name: 'custom base path',
      options: { authUrl: 'https://example.com/auth' },
    },
    {
      name: 'custom url with trailing slash',
      options: { authUrl: 'https://auth.example.com/' },
    },
  ])('refreshes exactly once with $name', async ({ options }) => {
    const nhost = createClient({
      ...options,
      functionsUrl: 'https://functions.example.com',
    });
    nhost.sessionStorage.set(createSession(expiredAccessToken));

    const res = await withinTimeout(nhost.functions.fetch('/hello'));
    expect(res.status).toBe(200);

    const tokenUrl = `${nhost.auth.baseURL}/token`;
    const tokenCalls = mockFetch.mock.calls.filter(
      ([url]) => String(url) === tokenUrl,
    );
    expect(tokenCalls).toHaveLength(1);

    const [, functionInit] = mockFetch.mock.calls.find(
      ([url]) => String(url) === 'https://functions.example.com/hello',
    ) ?? [undefined, undefined];
    expect(new Headers(functionInit?.headers).get('Authorization')).toBe(
      `Bearer ${refreshedAccessToken}`,
    );
  });

  test('skips refresh when Authorization is explicitly set', async () => {
    const nhost = createClient({
      authUrl: 'https://auth.example.com',
      functionsUrl: 'https://functions.example.com',
    });
    nhost.sessionStorage.set(createSession(expiredAccessToken));

    await withinTimeout(
      nhost.functions.fetch('/hello', {
        headers: { Authorization: 'Bearer explicit' },
      }),
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://functions.example.com/hello');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer explicit',
    );
  });
});
