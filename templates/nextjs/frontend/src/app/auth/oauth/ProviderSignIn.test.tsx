import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProviderSignIn from '@/app/auth/oauth/ProviderSignIn';
import { providers } from '@/app/auth/oauth/providers';
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

const render = async (destination = '/account'): Promise<string> =>
  renderToStaticMarkup(await ProviderSignIn({ destination }));

async function redirectTargets(destination?: string): Promise<string[]> {
  return [...(await render(destination)).matchAll(/redirectTo=([^"&]+)/g)].map(
    (m) => decodeURIComponent(m[1] ?? ''),
  );
}

describe('provider sign-in', () => {
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
    expect(await redirectTargets()).toHaveLength(providers.length);
  });

  it('offers only the providers the deployment set up', async () => {
    vi.stubEnv('NHOST_OAUTH_PROVIDERS', 'github');

    const html = await render();

    expect(html).toContain('Continue with GitHub');
    expect(html).not.toContain('Continue with Google');
  });

  // The destination is already a checked path (see `destination.ts`), and it
  // goes on the origin, so the provider sends the token back to this site.
  it('sends the provider back to where the visitor was going', async () => {
    for (const target of await redirectTargets('/protected')) {
      expect(target).toBe(`${appOrigin()}/protected`);
    }
  });
});
