import type { NhostClient } from '@nhost/nhost-js';
import type { StoredSession } from '@nhost/nhost-js/session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPassword } from '@/app/reset-password/actions';
import {
  clearRecoveryToken,
  createNhostClient,
  readRecoveryToken,
  writeRecoveryToken,
} from '@/lib/nhost/server';

// Everything except the cookie plumbing is the real thing: the action drives a
// real SDK client against a stubbed backend, so a flow that cannot work in a
// browser cannot pass here either. This suite exists because a release once
// shipped a reset page that asked for the password the user was resetting, and
// nothing failed.
vi.mock('@/lib/nhost/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/nhost/server')>()),
  readRecoveryToken: vi.fn(),
  writeRecoveryToken: vi.fn(),
  clearRecoveryToken: vi.fn(),
  createNhostClient: vi.fn(),
}));

const accessToken = (sub: string): string => {
  const claims = Buffer.from(
    JSON.stringify({
      sub,
      exp: Math.floor(Date.now() / 1000) + 900,
      'https://hasura.io/jwt/claims': { 'x-hasura-user-id': sub },
    }),
  ).toString('base64url');

  return `header.${claims}.signature`;
};

const sessionFor = (
  id: string,
  email: string,
  refreshToken: string = `${id}-refresh-token`,
): StoredSession =>
  ({
    accessToken: accessToken(id),
    accessTokenExpiresIn: 900,
    refreshTokenId: `${id}-refresh-token-id`,
    refreshToken,
    user: { id, email },
  }) as unknown as StoredSession;

const linkAccount = sessionFor('link-user-id', 'owner@example.com');
const browserAccount = sessionFor('browser-user-id', 'someone@example.com');

type Call = { url: string; body: Record<string, unknown>; auth?: string };

const calls: Call[] = [];

const stubBackend = (
  overrides: Record<string, { status: number; body: unknown }> = {},
): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      const headers = new Headers(init?.headers);

      calls.push({
        url: path,
        body: JSON.parse(String(init?.body ?? '{}')),
        auth: headers.get('authorization') ?? undefined,
      });

      const override = overrides[path];
      if (override) {
        return new Response(JSON.stringify(override.body), {
          status: override.status,
          headers: { 'content-type': 'application/json' },
        });
      }

      const body = path.endsWith('/token')
        ? linkAccount
        : path.endsWith('/signin/email-password')
          ? { session: browserAccount }
          : { ok: true };

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
};

// The session the browser already had. `set` records so a test can prove the
// reset never wrote over it.
const browserStorage = { set: vi.fn(), remove: vi.fn() };

const stubBrowserSession = (session: StoredSession | null): void => {
  vi.mocked(createNhostClient).mockImplementation(async () => {
    const { createServerClient } = await import('@nhost/nhost-js');
    let stored = session;

    return createServerClient({
      region: 'local',
      subdomain: 'local',
      storage: {
        get: () => stored,
        set: (value: StoredSession) => {
          browserStorage.set(value);
          stored = value;
        },
        remove: () => {
          browserStorage.remove();
          stored = null;
        },
      },
    }) as NhostClient;
  });
};

// The recovery cookie, modelled as state so the read after a re-park sees the
// value the previous call wrote. `writeRecoveryToken` rotates it, and
// `clearRecoveryToken` spends it, exactly as the httpOnly cookie does.
let recoveryCookie: string | null = null;

beforeEach(() => {
  calls.length = 0;
  browserStorage.set.mockClear();
  browserStorage.remove.mockClear();
  recoveryCookie = 'recovery-refresh-token';
  vi.mocked(readRecoveryToken).mockImplementation(async () => recoveryCookie);
  vi.mocked(writeRecoveryToken).mockImplementation(async (token: string) => {
    recoveryCookie = token;
  });
  vi.mocked(clearRecoveryToken).mockImplementation(async () => {
    recoveryCookie = null;
  });
  stubBackend();
  stubBrowserSession(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const at = (path: string): Call[] =>
  calls.filter((call) => call.url.endsWith(path));

describe('password reset', () => {
  // The flow end to end. Its whole premise is that the user does not know the
  // old password, so asking for one is the same as having no recovery at all.
  it('sets the password from the link alone', async () => {
    const result = await resetPassword('a-new-password');

    expect(result).toEqual({ success: true });

    expect(at('/token')[0]?.body).toEqual({
      refreshToken: 'recovery-refresh-token',
    });
    // Changed with the token the link produced, not with a password only the
    // owner would know.
    expect(at('/user/password')[0]?.body).toEqual({
      newPassword: 'a-new-password',
    });
    expect(at('/user/password')[0]?.auth).toBe(
      `Bearer ${linkAccount.accessToken}`,
    );
    expect(at('/signin/email-password')[0]?.body).toEqual({
      email: 'owner@example.com',
      password: 'a-new-password',
    });
  });

  it('spends the recovery cookie', async () => {
    await resetPassword('a-new-password');

    expect(clearRecoveryToken).toHaveBeenCalled();
  });

  // The link is opened in a browser already signed into a different account.
  // The password has to land on the account the link names, and the session
  // sitting here must not be written to.
  it('writes to the account the link names, not the one already signed in', async () => {
    stubBrowserSession(browserAccount);

    const result = await resetPassword('a-new-password');

    expect(result).toEqual({ success: true });
    expect(at('/user/password')[0]?.auth).toBe(
      `Bearer ${linkAccount.accessToken}`,
    );
    expect(at('/user/password')[0]?.auth).not.toBe(
      `Bearer ${browserAccount.accessToken}`,
    );
    // The only session written here is the one the new password earned.
    expect(at('/signin/email-password')[0]?.body).toMatchObject({
      email: 'owner@example.com',
    });
  });

  it('refuses when no link was redeemed in this browser', async () => {
    vi.mocked(readRecoveryToken).mockResolvedValue(null);

    const result = await resetPassword('a-new-password');

    expect(result.error).toContain('no longer valid');
    expect(calls).toEqual([]);
  });

  it('refuses when the recovery token has expired', async () => {
    stubBackend({
      '/v1/token': { status: 401, body: { error: 'invalid-refresh-token' } },
    });
    vi.stubGlobal('console', { ...console, error: vi.fn(), warn: vi.fn() });

    const result = await resetPassword('a-new-password');

    expect(result.error).toContain('no longer valid');
    expect(at('/user/password')).toEqual([]);
    expect(clearRecoveryToken).toHaveBeenCalled();
  });

  // Refresh tokens rotate on use, so the token the cookie held is dead the
  // instant the first attempt spends it. The action re-parks the rotated one,
  // and this proves it: a rejected password, then a clean reset on the retry.
  // Without the re-park the retry would present a spent token and the rotating
  // stub would answer 401, so the second call would report the link expired.
  it('re-parks the rotated token so a rejected password stays retryable', async () => {
    const seen = new Set<string>();
    let rotation = 0;
    let passwordAttempts = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown, init?: RequestInit) => {
        const path = new URL(String(url)).pathname;
        const body = JSON.parse(String(init?.body ?? '{}'));

        if (path.endsWith('/token')) {
          const presented = body.refreshToken as string;
          if (seen.has(presented)) {
            return new Response(
              JSON.stringify({ error: 'invalid-refresh-token' }),
              {
                status: 401,
                headers: { 'content-type': 'application/json' },
              },
            );
          }
          seen.add(presented);
          rotation += 1;
          return new Response(
            JSON.stringify(
              sessionFor(
                'link-user-id',
                'owner@example.com',
                `rotated-${rotation}`,
              ),
            ),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        if (path.endsWith('/user/password')) {
          passwordAttempts += 1;
          if (passwordAttempts === 1) {
            return new Response(
              JSON.stringify({
                error: 'password-too-short',
                message: 'password is too short',
              }),
              {
                status: 400,
                headers: { 'content-type': 'application/json' },
              },
            );
          }
        }

        const fallback = path.endsWith('/signin/email-password')
          ? { session: browserAccount }
          : { ok: true };

        return new Response(JSON.stringify(fallback), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    const rejected = await resetPassword('short');
    expect(rejected.error).toContain('Could not change the password');
    // The rejected attempt leaves a live token behind, not the one it spent.
    expect(recoveryCookie).toBe('rotated-1');
    expect(clearRecoveryToken).not.toHaveBeenCalled();

    const retried = await resetPassword('a-new-password');
    expect(retried).toEqual({ success: true });
    expect(clearRecoveryToken).toHaveBeenCalled();
  });

  it('reports a rejected password without signing anybody in', async () => {
    stubBackend({
      '/v1/user/password': {
        status: 400,
        body: { error: 'password-too-short', message: 'password is too short' },
      },
    });

    const result = await resetPassword('short');

    expect(result.error).toContain('Could not change the password');
    expect(at('/signin/email-password')).toEqual([]);
  });

  it('requires a password', async () => {
    expect(await resetPassword('')).toEqual({
      error: 'A password is required.',
    });
    expect(readRecoveryToken).not.toHaveBeenCalled();
  });
});
