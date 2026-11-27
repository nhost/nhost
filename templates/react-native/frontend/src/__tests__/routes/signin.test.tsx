import { router } from 'expo-router';
import {
  act,
  fireEvent,
  renderRouter,
  screen,
} from 'expo-router/testing-library';
import { Text } from 'react-native';
import RootLayout from '@/app/_layout';
import Home from '@/app/index';
import SignIn from '@/app/signin/index';
import { nhost } from '@/lib/nhost/client';
import { liveSession } from '@/test/session';

jest.mock('@/lib/nhost/client', () => ({
  ...jest.requireActual('@/lib/nhost/client'),
  checkSession: async () => 'live',
}));

// What the SDK does once `/signout` answers.
jest.mock('@/lib/nhost/actions', () => ({
  signOut: async () => {
    const { nhost: client } = jest.requireActual('@/lib/nhost/client');
    client.clearSession();
    return {};
  },
}));

const routes = {
  _layout: RootLayout,
  index: Home,
  'signin/index': SignIn,
  'account/index': () => <Text>account</Text>,
};

beforeEach(() => {
  nhost.sessionStorage.remove();
});

describe('/signin', () => {
  it('lists the ways in for a signed-out visitor', async () => {
    await renderRouter(routes, { initialUrl: '/signin?intent=sign-in' });

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeOnTheScreen();
    expect(screen.getByText(/New here\?/)).toBeOnTheScreen();
  });

  it('sends a signed-in user on to next', async () => {
    nhost.sessionStorage.set(liveSession());

    await renderRouter(routes, { initialUrl: '/signin?next=%2Faccount' });

    expect(screen).toHavePathname('/account');
  });
});

describe('signing out from the nav', () => {
  it('goes home with nothing to go back to', async () => {
    nhost.sessionStorage.set(liveSession());
    await renderRouter(routes, { initialUrl: '/' });
    await act(() => router.push('/account'));

    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

    expect(nhost.getUserSession()).toBeNull();
    expect(screen).toHavePathname('/');
    expect(router.canGoBack()).toBe(false);
    expect(screen.queryByText('account')).toBeNull();
    expect(
      screen.getAllByRole('link', { name: 'Sign in' }).length,
    ).toBeGreaterThan(0);
  });
});
