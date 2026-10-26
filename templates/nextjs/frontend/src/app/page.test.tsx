import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { signInQuery } from '@/app/signin/query';

const getUserSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({ getUserSession }),
}));
vi.mock('@/lib/nhost/actions', () => ({ signOutAndGoHome: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({}) }));

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
    expect(hrefOf(html, 'another way in')).toBe(
      `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`,
    );
  });

  // The one page behind the session, so it is where a signed-in visitor is
  // sent from here. Asserted because the last target this had was a page that
  // was later deleted, and nothing said so.
  it('sends a signed-in visitor to the account page', async () => {
    getUserSession.mockReturnValueOnce({ user: { email: 'ada@example.com' } });

    const html = await render();

    expect(html).toContain('signed in as ada@example.com');
    expect(hrefOf(html, 'Go to your account')).toBe('/account');
    expect(hrefOf(html, 'Sign up')).toBeUndefined();
  });

  // Signed in, the sign-in page would only send them on to the account, so
  // step two's link is the sign-out it asks for first.
  it('offers a signed-in visitor sign out rather than another way in', async () => {
    getUserSession.mockReturnValueOnce({ user: { email: 'ada@example.com' } });

    const html = await render();

    expect(html).toMatch(/<button[^>]*>sign out<\/button>/);
    expect(hrefOf(html, 'another way in')).toBeUndefined();
  });

  // Signing in lands there, so the steps have to say what it is.
  it('tells a signed-out visitor about the account page', async () => {
    getUserSession.mockReturnValueOnce(null);

    const html = await render();

    expect(html).toContain('Explore your account');
    expect(hrefOf(html, 'Go to your account')).toBeUndefined();
  });
});
