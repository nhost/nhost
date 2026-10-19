import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { signInQuery } from '@/app/signin/query';

const getUserSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({ getUserSession }),
}));

function hrefOf(html: string, label: string): string | undefined {
  return new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${label}</a>`).exec(html)?.[1];
}

const render = () => Home().then(renderToStaticMarkup);

describe('home page', () => {
  beforeEach(() => {
    getUserSession.mockReset();
  });

  // These links are where the intent starts. Built any other way, they would
  // be left behind by a change to `query.ts` and open on the default mode.
  it('links to each mode through signInQuery', async () => {
    getUserSession.mockReturnValueOnce(null);

    const html = await render();

    expect(hrefOf(html, 'Sign up')).toBe(
      `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`,
    );
    expect(hrefOf(html, 'Sign in')).toBe(
      `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`,
    );
  });

  // The one page behind the session, so it is where a signed-in visitor is
  // sent from here. Asserted because the last target this had was a page that
  // was later deleted, and nothing said so.
  it('sends a signed-in visitor to the account page', async () => {
    getUserSession.mockReturnValueOnce({ user: { email: 'ada@example.com' } });

    const html = await render();

    expect(hrefOf(html, 'Open your account')).toBe('/account');
  });
});
