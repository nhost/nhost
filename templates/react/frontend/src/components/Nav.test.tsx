import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import Nav from '@/components/Nav';
import { DEFAULT_DESTINATION } from '@/signin/destination';
import { signInQuery } from '@/signin/query';

vi.mock('@/lib/nhost/AuthProvider', () => ({
  useAuth: () => ({ session: null, isLoading: false }),
}));

describe('Nav', () => {
  // Built any other way, this link would be left behind by a change to
  // `query.ts` and open on the default mode.
  it('links to sign in through signInQuery', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Nav />
      </MemoryRouter>,
    );
    const href = /<a[^>]*href="([^"]*)"[^>]*>Sign in<\/a>/.exec(html)?.[1];

    expect(href).toBe(`/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`);
  });
});
