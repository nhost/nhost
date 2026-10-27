import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Nav from '@/components/Nav';

const session = vi.hoisted(() => ({
  current: null as {
    user: { email?: string; displayName?: string; avatarUrl?: string };
  } | null,
}));

const pathname = vi.hoisted(() => ({ current: '/' }));

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({ getUserSession: () => session.current }),
}));

vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

// A made-up method, so this test names no real one's pages.
vi.mock('@/app/signin/methods', () => ({
  methods: [{ signedOutPaths: ['/auth/method/finish'] }],
}));

// Client components that need the app router, which a static render has
// no business mounting. The nav's links are what is under test.
vi.mock('@/components/SignOutButton', () => ({ default: () => null }));
vi.mock('@/components/RefreshOnSessionChange', () => ({
  default: () => null,
}));

function _hrefOf(html: string, label: string): string | undefined {
  return new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${label}</a>`).exec(html)?.[1];
}

describe('Nav', () => {
  beforeEach(() => {
    session.current = null;
    pathname.current = '/';
  });

  it('links a signed-in visitor to their account by their picture', async () => {
    session.current = {
      user: {
        email: 'user@example.com',
        displayName: 'Ada',
        avatarUrl: '/api/avatar/current',
      },
    };

    const html = renderToStaticMarkup(await Nav());

    expect(html).toContain('href="/account"');
    expect(html).toContain('src="/api/avatar/current"');
    expect(html).not.toContain('>Sign in<');
    expect(html).not.toContain('>Sign up<');
  });

  // A reset link signs the visitor in only so the new password can be saved;
  // until then the nav should not say they are signed in.
  it('looks signed out on a method page that asks for it', async () => {
    session.current = {
      user: { displayName: 'Ada', avatarUrl: '/api/avatar/current' },
    };

    for (const path of ['/auth/method/finish', '/auth/method/finish/step']) {
      pathname.current = path;
      const html = renderToStaticMarkup(await Nav());

      expect(html).not.toContain('href="/account"');
      expect(html).toContain('>Sign in<');
      expect(html).toContain('>Sign up<');
    }
  });
});
