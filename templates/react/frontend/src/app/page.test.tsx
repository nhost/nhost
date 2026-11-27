import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';

const session = vi.hoisted(() => ({
  current: null as { user: { id: string; email?: string } } | null,
}));

vi.mock('@/lib/nhost/AuthProvider', () => ({
  useSession: () => session.current,
}));
vi.mock('@/lib/nhost/actions', () => ({ signOut: vi.fn() }));

function hrefOf(html: string, label: string): string | undefined {
  return new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${label}</a>`).exec(html)?.[1];
}

const render = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );

describe('home page', () => {
  beforeEach(() => {
    session.current = null;
  });

  it('sends a signed-out visitor to sign up, or to sign in another way', () => {
    const html = render();

    expect(hrefOf(html, 'Sign up')).toBe('/signin');
    expect(hrefOf(html, 'another way in')).toBe('/signin?intent=sign-in');
  });

  // The one page behind the session, so it is where a signed-in visitor is sent
  // from here.
  it('sends a signed-in visitor to the account page', () => {
    session.current = { user: { id: 'user-id', email: 'ada@example.com' } };

    const html = render();

    expect(html).toContain('signed in as ada@example.com');
    expect(hrefOf(html, 'Go to your account')).toBe('/account');
    expect(hrefOf(html, 'Sign up')).toBeUndefined();
  });
});
