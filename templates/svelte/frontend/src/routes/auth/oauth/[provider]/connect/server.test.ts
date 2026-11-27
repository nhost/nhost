import { createServerClient } from '@nhost/nhost-js';
import { isRedirect, type RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appOrigin } from '#lib/nhost/env.server.ts';
import { fakeEvent } from '#lib/testing/requestEvent.ts';
import { GET } from './+server.ts';

const session = vi.hoisted(() => ({
  current: null as { accessToken: string } | null,
}));

vi.mock('$app/env/public', () => ({ NHOST_OAUTH_PROVIDERS: 'github' }));

// The SDK's own URL builder, over a session the test sets, so the query the
// auth service would receive is the real one.
vi.mock('#lib/nhost/server.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#lib/nhost/server.ts')>()),
  createNhostClient: () =>
    createServerClient({
      storage: {
        get: () => session.current as never,
        set: () => undefined,
        remove: () => undefined,
      },
    }),
}));

function location(provider: string): string {
  const { event } = fakeEvent({
    url: `http://localhost/auth/oauth/${provider}/connect`,
  });
  Object.assign(event, { params: { provider } });
  try {
    GET(
      event as RequestEvent<
        { provider: string },
        '/auth/oauth/[provider]/connect'
      >,
    );
  } catch (err) {
    if (isRedirect(err)) {
      return err.location;
    }
    throw err;
  }
  throw new Error('no redirect');
}

describe('provider connect route', () => {
  beforeEach(() => {
    session.current = { accessToken: 'access-token' };
  });

  it('sends the session to the provider as the account to connect to', () => {
    const url = new URL(location('github'));

    expect(url.pathname).toBe('/v1/signin/provider/github');
    expect(url.searchParams.get('connect')).toBe('access-token');
    expect(url.searchParams.get('redirectTo')).toBe(`${appOrigin()}/account`);
  });

  it('sends a signed-out visitor to sign in first', () => {
    session.current = null;

    expect(location('github')).toBe('/signin?next=%2Faccount');
  });
});
