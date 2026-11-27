import type { User } from '@nhost/nhost-js/auth';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { hrefOf } from '#lib/testing/html.ts';
import Home from './+page.svelte';

const html = (user: Partial<User> | null): string =>
  render(Home, { props: { data: { user }, params: {} } as never }).body;

describe('home page', () => {
  // The one page behind the session, so it is where a signed-in visitor is sent
  // from here.
  it('sends a signed-in visitor to the account page', () => {
    const page = html({ email: 'ada@example.com' });

    expect(page).toContain('signed in as ada@example.com');
    expect(hrefOf(page, 'Go to your account')).toBe('/account');
    expect(hrefOf(page, 'Sign up')).toBeUndefined();
  });

  it('offers a signed-out visitor the sign-up page', () => {
    expect(hrefOf(html(null), 'Sign up')).toBe('/signin');
  });
});
