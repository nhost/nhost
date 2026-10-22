import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { signInQuery } from '@/app/signin/query';
import Nav from '@/components/Nav';

const session = vi.hoisted(() => ({
  current: null as {
    user: { email?: string; displayName?: string; avatarUrl?: string };
  } | null,
}));

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({ getUserSession: () => session.current }),
}));

// Client components that need the app router, which a static render has
// no business mounting. The nav's links are what is under test.
vi.mock('@/components/SignOutButton', () => ({ default: () => null }));
vi.mock('@/components/RefreshOnSessionChange', () => ({
  default: () => null,
}));

function hrefOf(html: string, label: string): string | undefined {
  return new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${label}</a>`).exec(html)?.[1];
}

describe('Nav', () => {
  beforeEach(() => {
    session.current = null;
  });

  // Built any other way, this link would be left behind by a change to
  // `query.ts` and open on the default mode.
  it('links to sign in through signInQuery', async () => {
    const html = renderToStaticMarkup(await Nav());

    expect(hrefOf(html, 'Sign in')).toBe(
      `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`,
    );
  });

  it('links to sign up through signInQuery', async () => {
    const html = renderToStaticMarkup(await Nav());

    expect(hrefOf(html, 'Sign up')).toBe(
      `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`,
    );
  });

  // No account yet, so no avatar either.
  it('shows no avatar when signed out', async () => {
    const html = renderToStaticMarkup(await Nav());

    expect(html).not.toContain('rounded-full');
    expect(html).not.toContain('href="/account"');
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

  // The address is on the page this leads to; repeating it here crowded the
  // sign-out beside it.
  it('does not put the address in the nav', async () => {
    session.current = {
      user: {
        email: 'user@example.com',
        displayName: 'Ada',
        avatarUrl: '/api/avatar/current',
      },
    };

    expect(renderToStaticMarkup(await Nav())).not.toContain('user@example.com');
  });

  // The avatar is decorative, so the link has to say where it goes itself.
  it('names the account link for a screen reader', async () => {
    session.current = {
      user: { displayName: 'Ada', avatarUrl: '/api/avatar/current' },
    };

    expect(renderToStaticMarkup(await Nav())).toContain('Your account');
  });

  // An account with no picture still needs something to click.
  it('falls back to the initial when there is no picture', async () => {
    session.current = { user: { displayName: 'Ada' } };

    const html = renderToStaticMarkup(await Nav());

    expect(html).toContain('href="/account"');
    expect(html).toContain('>A<');
    expect(html).not.toContain('<img');
  });

  // The backend sets a `d=blank` gravatar URL on every new account, which
  // for an unknown address is a transparent image. The initial has to be
  // under it or the link is an empty space.
  it('keeps the initial under a picture that may draw nothing', async () => {
    session.current = {
      user: {
        displayName: 'Ada',
        avatarUrl: 'https://www.gravatar.com/avatar/0?d=blank&r=g',
      },
    };

    const html = renderToStaticMarkup(await Nav());

    expect(html).toContain('>A<');
    expect(html).toContain(
      'src="https://www.gravatar.com/avatar/0?d=blank&amp;r=g"',
    );
  });
});
