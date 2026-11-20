import { renderRouter, screen } from 'expo-router/testing-library';
import RootLayout from '@/app/_layout';
import NotFoundRoute from '@/app/+not-found';
import Account from '@/app/account/index';
import Home from '@/app/index';
import { nhost } from '@/lib/nhost/client';
import { liveSession } from '@/test/session';

jest.mock('@/lib/nhost/client', () => ({
  ...jest.requireActual('@/lib/nhost/client'),
  checkSession: async () => 'live',
}));

const routes = {
  _layout: RootLayout,
  index: Home,
  'account/index': Account,
  '+not-found': NotFoundRoute,
};

beforeEach(() => {
  nhost.sessionStorage.remove();
});

describe('/account', () => {
  // Sign-in has no screen yet, so the redirect lands on not-found.
  it('sends a signed-out user to sign in and back', async () => {
    const router = await renderRouter(routes, { initialUrl: '/account' });

    expect(router.getPathname()).toBe('/signin');
    expect(router.getSearchParams()).toMatchObject({ next: '/account' });
    expect(screen.getByText('This page could not be found.')).toBeOnTheScreen();
    expect(screen.queryByRole('heading', { name: 'Account' })).toBeNull();
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

    expect(screen.getByRole('heading', { name: 'Account' })).toBeOnTheScreen();
  });
});
