import type { User } from '@nhost/nhost-js/auth';
import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Nav from './Nav.svelte';

const pathname = vi.hoisted(() => ({ current: '/' }));

vi.mock('$app/state', () => ({
  page: {
    get url() {
      return new URL(`http://localhost${pathname.current}`);
    },
  },
}));

// A made-up method, so this test names no real one's pages.
vi.mock('#routes/signin/methods.ts', () => ({
  methods: [{ signedOutPaths: ['/auth/method/finish'] }],
}));

const html = (user: Partial<User> | null): string =>
  render(Nav, { props: { user: user as User | null } }).body;

describe('Nav', () => {
  beforeEach(() => {
    pathname.current = '/';
  });

  it('links a signed-in visitor to their account by their picture', () => {
    const page = html({
      email: 'user@example.com',
      displayName: 'Ada',
      avatarUrl: '/api/avatar/current',
    });

    expect(page).toContain('href="/account"');
    expect(page).toContain('src="/api/avatar/current"');
    expect(page).not.toMatch(/>\s*Sign in\s*</);
    expect(page).not.toMatch(/>\s*Sign up\s*</);
  });

  // A reset link signs the visitor in only so the new password can be saved;
  // until then the nav should not say they are signed in.
  it('looks signed out on a method page that asks for it', () => {
    for (const path of ['/auth/method/finish', '/auth/method/finish/step']) {
      pathname.current = path;
      const page = html({
        displayName: 'Ada',
        avatarUrl: '/api/avatar/current',
      });

      expect(page).not.toContain('href="/account"');
      expect(page).toMatch(/>\s*Sign in\s*</);
      expect(page).toMatch(/>\s*Sign up\s*</);
    }
  });
});
