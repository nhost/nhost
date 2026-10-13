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

const render = (params: Record<string, string> = {}) =>
  Home({ searchParams: Promise.resolve(params) }).then(renderToStaticMarkup);

describe('home page', () => {
  // These links are where the intent starts. Built any other way, they would
  // be left behind by a change to `query.ts` and open on the default mode.
  it('links to each mode through signInQuery', async () => {
    const html = await render();

    expect(hrefOf(html, 'Sign up')).toBe(
      `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`,
    );
    expect(hrefOf(html, 'Sign in')).toBe(
      `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`,
    );
  });

  // The auth service sends a failed email link or provider sign-in back here
  // with the reason in the query.
  it('shows why an auth redirect failed', async () => {
    const html = await render({
      error: 'disabled-endpoint',
      errorDescription: 'This endpoint is disabled',
    });

    expect(html).toContain('This endpoint is disabled');
  });

  it('shows no notice on an ordinary visit', async () => {
    expect(await render()).not.toContain('role="alert"');
  });
});
