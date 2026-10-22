import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OAuth from '@/app/auth/oauth/page';
import { providers } from '@/app/auth/oauth/providers';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { appOrigin } from '@/lib/nhost/env';

// Stands in for the SDK's URL builder with something the test can read the
// redirectTo back out of.
vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({
    auth: {
      signInProviderURL: (id: string, opts: { redirectTo: string }) =>
        `https://auth.test/v1/signin/provider/${id}?redirectTo=${encodeURIComponent(opts.redirectTo)}`,
    },
  }),
}));

async function redirectTargets(next?: string): Promise<string[]> {
  const html = renderToStaticMarkup(
    await OAuth({ searchParams: Promise.resolve(next ? { next } : {}) }),
  );
  return [...html.matchAll(/redirectTo=([^"&]+)/g)].map((m) =>
    decodeURIComponent(m[1] ?? ''),
  );
}

describe('OAuth page', () => {
  beforeEach(() => {
    vi.stubEnv(
      'NHOST_OAUTH_PROVIDERS',
      providers.map((provider) => provider.id).join(','),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('offers every configured provider', async () => {
    const targets = await redirectTargets();

    expect(targets).toHaveLength(providers.length);
  });

  it('offers only the providers the deployment set up', async () => {
    vi.stubEnv('NHOST_OAUTH_PROVIDERS', 'github');

    const html = renderToStaticMarkup(
      await OAuth({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain('Continue with GitHub');
    expect(html).not.toContain('Continue with Google');
  });

  it('says so when no provider is set up', async () => {
    vi.stubEnv('NHOST_OAUTH_PROVIDERS', '');

    const html = renderToStaticMarkup(
      await OAuth({ searchParams: Promise.resolve({}) }),
    );

    expect(await redirectTargets()).toHaveLength(0);
    expect(html).toContain('No provider is set up.');
  });

  it('sends the provider back to the requested path', async () => {
    for (const target of await redirectTargets('/protected')) {
      expect(target).toBe(`${appOrigin()}/protected`);
    }
  });

  // `next` is appended to the origin, so anything that is not a path on this
  // site would change the host the provider sends the token back to.
  it('keeps the callback on this origin', async () => {
    for (const hostile of ['-attacker.example/', '//evil.example', '.evil']) {
      for (const target of await redirectTargets(hostile)) {
        expect(target).toBe(`${appOrigin()}${DEFAULT_DESTINATION}`);
      }
    }
  });
});
