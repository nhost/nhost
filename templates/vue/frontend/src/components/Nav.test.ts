// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Nav from '@/components/Nav.vue';
import { hrefOf, mountAt } from '@/test/mount';

const session = vi.hoisted(() => ({
  current: null as {
    user: { email?: string; displayName?: string };
  } | null,
}));

vi.mock('@/lib/nhost/auth', async () => {
  const { computed } = await import('vue');
  return { useSession: () => computed(() => session.current) };
});

// A made-up method, so this test names no real one's pages.
vi.mock('@/app/signin/methods', () => ({
  methods: [{ signedOutPaths: ['/auth/method/finish'] }],
}));

// It signs out through the client, which this test has no business loading.
// The nav's links are what is under test.
vi.mock('@/components/SignOutButton.vue', () => ({
  default: { render: () => null },
}));

const render = async (path = '/') => (await mountAt(Nav, path)).el;

describe('Nav', () => {
  beforeEach(() => {
    session.current = null;
  });

  it('offers a signed-out visitor both ways in', async () => {
    const nav = await render();

    expect(hrefOf(nav, 'Sign in')).toBe('/signin?intent=sign-in');
    expect(hrefOf(nav, 'Sign up')).toBe('/signin');
    expect(nav.querySelector('a[href="/account"]')).toBeNull();
  });

  it('links a signed-in visitor to their account by their initial', async () => {
    session.current = {
      user: { email: 'user@example.com', displayName: 'Ada' },
    };

    const nav = await render();

    expect(
      nav.querySelector('a[href="/account"] [aria-hidden]')?.textContent,
    ).toContain('A');
    expect(hrefOf(nav, 'Sign in')).toBeUndefined();
    expect(hrefOf(nav, 'Sign up')).toBeUndefined();
  });

  // A reset link signs the visitor in only so the new password can be saved;
  // until then the nav should not say they are signed in.
  it('looks signed out on a method page that asks for it', async () => {
    session.current = { user: { displayName: 'Ada' } };

    for (const path of ['/auth/method/finish', '/auth/method/finish/step']) {
      const nav = await render(path);

      expect(nav.querySelector('a[href="/account"]')).toBeNull();
      expect(hrefOf(nav, 'Sign in')).toBeDefined();
      expect(hrefOf(nav, 'Sign up')).toBeDefined();
    }

    expect(
      (await render('/auth/method/finished')).querySelector(
        'a[href="/account"]',
      ),
    ).not.toBeNull();
  });
});
