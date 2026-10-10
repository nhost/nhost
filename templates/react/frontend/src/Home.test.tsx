import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import Home from '@/Home';
import { DEFAULT_DESTINATION } from '@/signin/destination';
import { signInQuery } from '@/signin/query';

vi.mock('@/lib/nhost/AuthProvider', () => ({
  useAuth: () => ({ session: null, isLoading: false }),
}));

function hrefOf(html: string, label: string): string | undefined {
  return new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${label}</a>`).exec(html)?.[1];
}

describe('Home', () => {
  // These links are where the intent starts. Built any other way, they would
  // be left behind by a change to `query.ts` and open on the default mode.
  it('links to each mode through signInQuery', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(hrefOf(html, 'Sign up')).toBe(
      `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`,
    );
    expect(hrefOf(html, 'Sign in')).toBe(
      `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`,
    );
  });
});
