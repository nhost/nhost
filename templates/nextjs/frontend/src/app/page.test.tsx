import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { signInQuery } from '@/app/signin/query';

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({ getUserSession: () => null }),
}));

function hrefOf(html: string, label: string): string | undefined {
  return new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${label}</a>`).exec(html)?.[1];
}

describe('home page', () => {
  // These links are where the intent starts. Built any other way, they would
  // be left behind by a change to `query.ts` and open on the default mode.
  it('links to each mode through signInQuery', async () => {
    const html = renderToStaticMarkup(await Home());

    expect(hrefOf(html, 'Sign up')).toBe(
      `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`,
    );
    expect(hrefOf(html, 'Sign in')).toBe(
      `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`,
    );
  });
});
