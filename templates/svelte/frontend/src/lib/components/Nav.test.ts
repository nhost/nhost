import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import Nav from '$lib/components/Nav.svelte';
import { DEFAULT_DESTINATION } from '$lib/signin/destination';
import { signInQuery } from '$lib/signin/query';

vi.mock('$lib/nhost/auth.svelte', () => ({
  useAuth: () => ({ session: null }),
}));

describe('Nav', () => {
  // Built any other way, this link would be left behind by a change to
  // `query.ts` and open on the default mode.
  it('links to sign in through signInQuery', () => {
    // Svelte marks its blocks with comments, which would split the label.
    const html = render(Nav).body.replace(/<!--.*?-->/g, '');
    const href = /<a[^>]*href="([^"]*)"[^>]*>Sign in<\/a>/.exec(html)?.[1];

    expect(href).toBe(`/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`);
  });
});
