import { createServerClient } from '@nhost/nhost-js';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/auth/oauth/[provider]/connect/route';
import { appOrigin } from '@/lib/nhost/env';

const session = vi.hoisted(() => ({
  current: null as { accessToken: string } | null,
}));

// The SDK's own URL builder, over a session the test sets, so the query the
// auth service would receive is the real one.
vi.mock('@/lib/nhost/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/nhost/server')>()),
  createNhostClient: async () =>
    createServerClient({
      storage: {
        get: () => session.current as never,
        set: () => undefined,
        remove: () => undefined,
      },
    }),
}));

const get = (provider: string) =>
  GET(new NextRequest(`http://localhost/auth/oauth/${provider}/connect`), {
    params: Promise.resolve({ provider }),
  });

describe('provider connect route', () => {
  beforeEach(() => {
    vi.stubEnv('NHOST_OAUTH_PROVIDERS', 'github');
    session.current = { accessToken: 'access-token' };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends the session to the provider as the account to connect to', async () => {
    const location = new URL(
      (await get('github')).headers.get('location') ?? '',
    );

    expect(location.pathname).toBe('/v1/signin/provider/github');
    expect(location.searchParams.get('connect')).toBe('access-token');
    expect(location.searchParams.get('redirectTo')).toBe(
      `${appOrigin()}/account`,
    );
  });
});
