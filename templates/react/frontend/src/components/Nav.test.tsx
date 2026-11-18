import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Nav from '@/components/Nav';

const session = vi.hoisted(() => ({
  current: null as {
    user: { email?: string; displayName?: string };
  } | null,
}));

vi.mock('@/lib/nhost/AuthProvider', () => ({
  useSession: () => session.current,
}));

// A made-up method, so this test names no real one's pages.
vi.mock('@/app/signin/methods', () => ({
  methods: [{ signedOutPaths: ['/auth/method/finish'] }],
}));

// It signs out through the client, which a static render has no business
// loading. The nav's links are what is under test.
vi.mock('@/components/SignOutButton', () => ({ default: () => null }));

function hrefOf(html: string, label: string): string | undefined {
  return new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${label}</a>`).exec(html)?.[1];
}

const render = (path = '/') =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Nav />
    </MemoryRouter>,
  );

describe('Nav', () => {
  beforeEach(() => {
    session.current = null;
  });

  it('offers a signed-out visitor both ways in', () => {
    const html = render();

    expect(hrefOf(html, 'Sign in')).toBe('/signin?intent=sign-in');
    expect(hrefOf(html, 'Sign up')).toBe('/signin');
    expect(html).not.toContain('href="/account"');
  });

  it('links a signed-in visitor to their account by their initial', () => {
    session.current = {
      user: { email: 'user@example.com', displayName: 'Ada' },
    };

    const html = render();

    expect(html).toMatch(/href="\/account"[^>]*>(?:(?!<\/a>).)*>A</);
    expect(html).not.toContain('>Sign in<');
    expect(html).not.toContain('>Sign up<');
  });

  // A reset link signs the visitor in only so the new password can be saved;
  // until then the nav should not say they are signed in.
  it('looks signed out on a method page that asks for it', () => {
    session.current = { user: { displayName: 'Ada' } };

    for (const path of ['/auth/method/finish', '/auth/method/finish/step']) {
      const html = render(path);

      expect(html).not.toContain('href="/account"');
      expect(html).toContain('>Sign in<');
      expect(html).toContain('>Sign up<');
    }

    expect(render('/auth/method/finished')).toContain('href="/account"');
  });
});
