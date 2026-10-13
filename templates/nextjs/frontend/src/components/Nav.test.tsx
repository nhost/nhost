import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { signInQuery } from '@/app/signin/query';
import Nav from '@/components/Nav';

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({ getUserSession: () => null }),
}));

describe('Nav', () => {
  // Built any other way, this link would be left behind by a change to
  // `query.ts` and open on the default mode.
  it('links to sign in through signInQuery', async () => {
    const html = renderToStaticMarkup(await Nav());
    const href = /<a[^>]*href="([^"]*)"[^>]*>Sign in<\/a>/.exec(html)?.[1];

    expect(href).toBe(`/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`);
  });
});
