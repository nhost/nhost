import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { signInQuery } from '@/app/signin/query';
import Nav from '@/components/Nav';

const session = vi.hoisted(() => ({
  current: null as { user: { email?: string } } | null,
}));

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({ getUserSession: () => session.current }),
}));

// A client component that needs the app router, which a static render has
// no business mounting. The nav's links are what is under test.
vi.mock('@/components/SignOutButton', () => ({ default: () => null }));

function hrefOf(html: string, label: string): string | undefined {
  return new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${label}</a>`).exec(html)?.[1];
}

describe('Nav', () => {
  beforeEach(() => {
    session.current = null;
  });

  // Built any other way, this link would be left behind by a change to
  // `query.ts` and open on the default mode.
  it('links to sign in through signInQuery', async () => {
    const html = renderToStaticMarkup(await Nav());

    expect(hrefOf(html, 'Sign in')).toBe(
      `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`,
    );
  });

  it('links a signed-in visitor to their account by email', async () => {
    session.current = { user: { email: 'user@example.com' } };

    const html = renderToStaticMarkup(await Nav());

    expect(hrefOf(html, 'user@example.com')).toBe('/account');
    expect(html).not.toContain('>Sign in<');
  });
});
