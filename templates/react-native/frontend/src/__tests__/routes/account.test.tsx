import type { User } from '@nhost/nhost-js/auth';
import { renderRouter, screen } from 'expo-router/testing-library';
import RootLayout from '@/app/_layout';
import NotFoundRoute from '@/app/+not-found';
import AccountLayout from '@/app/account/_layout';
import Account from '@/app/account/index';
import Home from '@/app/index';
import SignIn from '@/app/signin/index';
import { nhost } from '@/lib/nhost/client';
import { liveSession } from '@/test/session';

jest.mock('@/lib/nhost/client', () => ({
  ...jest.requireActual('@/lib/nhost/client'),
  checkSession: async () => 'live',
  getVerifiedUser: async () => ({
    user: {
      id: 'user-id',
      email: 'ada@example.com',
      displayName: 'Ada',
      defaultRole: 'user',
      locale: 'en',
      createdAt: '2026-10-13T16:00:00Z',
    } as User,
  }),
}));

const routes = {
  _layout: RootLayout,
  index: Home,
  'account/_layout': AccountLayout,
  'account/index': Account,
  'signin/index': SignIn,
  '+not-found': NotFoundRoute,
};

beforeEach(() => {
  nhost.sessionStorage.remove();
});

describe('/account', () => {
  it('sends a signed-out user to sign in and back', async () => {
    const router = await renderRouter(routes, { initialUrl: '/account' });

    expect(router.getPathname()).toBe('/signin');
    expect(router.getSearchParams()).toMatchObject({ next: '/account' });
    expect(
      screen.getByRole('heading', { name: 'Create an account' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/ada@example\.com/)).toBeNull();
  });

  // What `+native-intent` makes of a link it could not sign in with.
  it('carries the error from a link on to sign-in', async () => {
    const router = await renderRouter(routes, {
      initialUrl: '/account?error=link-unusable',
    });

    expect(router.getPathname()).toBe('/signin');
    expect(router.getSearchParams()).toMatchObject({
      next: '/account',
      error: 'link-unusable',
    });
    expect(
      screen.getByText(/Open it on the device that asked for it/),
    ).toBeOnTheScreen();
  });

  it('shows the account to a signed-in user', async () => {
    nhost.sessionStorage.set(liveSession());

    await renderRouter(routes, { initialUrl: '/account' });

    expect(screen.getByText(/ada@example\.com/)).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: 'Your account' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Delete account' }),
    ).toBeOnTheScreen();
  });
});
