import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/auth/oauth/[provider]/route';
import { appOrigin } from '@/lib/nhost/env';

// Stands in for the SDK's URL builder with something the test can read the
// options back out of.
vi.mock('@/lib/nhost/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/nhost/server')>()),
  createNhostClient: async () => ({
    auth: {
      signInProviderURL: (
        id: string,
        opts: { redirectTo: string; upstreamParams?: Record<string, string> },
      ) => {
        const url = new URL(`https://auth.test/v1/signin/provider/${id}`);
        url.searchParams.set('redirectTo', opts.redirectTo);
        for (const [key, value] of Object.entries(opts.upstreamParams ?? {})) {
          url.searchParams.set(`upstreamParams[${key}]`, value);
        }
        return url.toString();
      },
    },
  }),
}));

const get = (provider: string, query = '') =>
  GET(new NextRequest(`http://localhost/auth/oauth/${provider}${query}`), {
    params: Promise.resolve({ provider }),
  });

const redirectTo = (location: string | null): string | null =>
  new URL(location ?? '').searchParams.get('redirectTo');

describe('provider route', () => {
  beforeEach(() => {
    vi.stubEnv('NHOST_OAUTH_PROVIDERS', 'google');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends the visitor to the provider through the auth service', async () => {
    const response = await get('google');

    expect(response.headers.get('location')).toMatch(
      /^https:\/\/auth\.test\/v1\/signin\/provider\/google\?/,
    );
  });

  // The destination goes on the origin, so the provider sends the token back
  // to this site.
  it('sends the provider back to where the visitor was going', async () => {
    const response = await get('google', '?next=%2Fprotected');

    expect(redirectTo(response.headers.get('location'))).toBe(
      `${appOrigin()}/protected`,
    );
  });

  // `next` is attacker-controlled; it is held to a path on this site.
  it('never sends the provider off this origin', async () => {
    const response = await get('google', '?next=%2F%2Fevil.example');

    expect(redirectTo(response.headers.get('location'))).toBe(
      `${appOrigin()}/account`,
    );
  });

  // Otherwise a provider the user authorized before, linked here or not,
  // signs them in without showing anything.
  it('asks the provider to show its account picker', async () => {
    const response = await get('google');

    expect(
      new URL(response.headers.get('location') ?? '').searchParams.get(
        'upstreamParams[prompt]',
      ),
    ).toBe('select_account');
  });

  // Noted so the sign-in list can mark the provider once the session starts.
  it('records the attempt', async () => {
    const response = await get('google');

    expect(response.cookies.get('nhostSignInAttempt')?.value).toBe(
      '/auth/oauth/google',
    );
  });

  it('refuses a provider the deployment did not set up', async () => {
    const response = await get('github');

    expect(response.status).toBe(404);
    expect(response.cookies.get('nhostSignInAttempt')).toBeUndefined();
  });
});
