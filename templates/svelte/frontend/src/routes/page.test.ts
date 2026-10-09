import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_DESTINATION } from '$lib/signin/destination';
import { signInQuery } from '$lib/signin/query';
import Home from './+page.svelte';

vi.mock('$lib/nhost/auth.svelte', () => ({
  useAuth: () => ({ session: null }),
}));

function hrefOf(html: string, label: string): string | undefined {
  return new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${label}</a>`).exec(html)?.[1];
}

describe('home page', () => {
  // These links are where the intent starts. Built any other way, they would
  // be left behind by a change to `query.ts` and open on the default mode.
  it('links to each mode through signInQuery', () => {
    // Svelte marks its blocks with comments, which would split the label.
    const html = render(Home).body.replace(/<!--.*?-->/g, '');

    expect(hrefOf(html, 'Sign up')).toBe(
      `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`,
    );
    expect(hrefOf(html, 'Sign in')).toBe(
      `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`,
    );
  });
});
