import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import OAuth from '@/app/auth/oauth/page';
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

async function redirectTargets(next?: string): Promise<string[]> {
  const html = renderToStaticMarkup(
    await OAuth({ searchParams: Promise.resolve(next ? { next } : {}) }),
  );
  return [...html.matchAll(/redirectTo=([^"&]+)/g)].map((m) =>
    decodeURIComponent(m[1] ?? ''),
  );
}

describe('OAuth page', () => {
  it('offers every provider in providers.ts', async () => {
    const targets = await redirectTargets();

    expect(targets).toHaveLength(providers.length);
  });

  it('sends the provider back to the requested path', async () => {
    for (const target of await redirectTargets('/account')) {
      expect(target).toBe(`${appOrigin()}/account`);
    }
  });

  // `next` is appended to the origin, so anything that is not a path on this
  // site would change the host the provider sends the token back to.
  it('keeps the callback on this origin', async () => {
    for (const hostile of ['-attacker.example/', '//evil.example', '.evil']) {
      for (const target of await redirectTargets(hostile)) {
        expect(target).toBe(`${appOrigin()}/`);
      }
    }
  });
});
