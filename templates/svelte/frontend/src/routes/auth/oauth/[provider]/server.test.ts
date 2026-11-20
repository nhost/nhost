import { createServerClient } from '@nhost/nhost-js';
import { isHttpError, isRedirect, type RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { appOrigin } from '#lib/nhost/env.server.ts';
import { fakeEvent } from '#lib/testing/requestEvent.ts';
import { GET } from './+server.ts';

vi.mock('$app/env/public', () => ({ NHOST_OAUTH_PROVIDERS: 'google' }));

// The SDK's own URL builder, so the query the auth service would receive is
// the real one.
vi.mock('#lib/nhost/server.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#lib/nhost/server.ts')>()),
  createNhostClient: () =>
    createServerClient({
      storage: {
        get: () => null,
        set: () => undefined,
        remove: () => undefined,
      },
    }),
}));

// What the route answers for `provider`, and the cookies it set.
function get(provider: string, query = '') {
  const { event, written } = fakeEvent({
    url: `http://localhost/auth/oauth/${provider}${query}`,
  });
  Object.assign(event, { params: { provider } });
  try {
    GET(event as RequestEvent<{ provider: string }, '/auth/oauth/[provider]'>);
  } catch (err) {
    if (isRedirect(err)) {
      return { location: new URL(err.location), written };
    }
    if (isHttpError(err)) {
      return { status: err.status, written };
    }
    throw err;
  }
  throw new Error('no answer');
}

describe('provider route', () => {
  // `next` is attacker-controlled; it is held to a path on this site.
  it('never sends the provider off this origin', () => {
    const { location } = get('google', '?next=%2F%2Fevil.example');

    expect(location?.searchParams.get('redirectTo')).toBe(
      `${appOrigin()}/account`,
    );
  });

  // Otherwise a provider the user authorized before, linked here or not,
  // signs them in without showing anything.
  it('asks the provider to show its account picker', () => {
    const { location } = get('google');

    expect(location?.searchParams.get('upstreamParams[prompt]')).toBe(
      'select_account',
    );
  });

  // `/auth/oauth/<id>` is not a method page, so the hook does not note it.
  it('notes the attempt, to mark the provider last used', () => {
    expect(get('google').written.get('nhostSignInAttempt')?.value).toBe(
      '/auth/oauth/google',
    );
  });

  it('knows only the providers the deployment set up', () => {
    expect(get('github').status).toBe(404);
  });
});
