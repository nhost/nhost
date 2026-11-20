import type { StoredSession } from '@nhost/nhost-js/session';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import Home from '@/screens/page';

const mockSession = { current: null as Pick<StoredSession, 'user'> | null };

jest.mock('@/lib/nhost/AuthProvider', () => ({
  useSession: () => mockSession.current,
}));
jest.mock('@/lib/nhost/actions', () => ({ signOut: jest.fn() }));

const routes = {
  index: Home,
  'signin/index': () => null,
  'account/index': () => null,
};

beforeEach(() => {
  mockSession.current = null;
});

describe('home screen', () => {
  it('sends a signed-out visitor to sign up', async () => {
    await renderRouter(routes);

    await fireEvent.press(screen.getByRole('link', { name: 'Sign up' }));

    expect(screen).toHavePathname('/signin');
    expect(screen).toHaveSearchParams({});
  });

  it('sends a signed-out visitor to sign in another way', async () => {
    await renderRouter(routes);

    await fireEvent.press(screen.getByRole('link', { name: 'another way in' }));

    expect(screen).toHavePathname('/signin');
    expect(screen).toHaveSearchParams({ intent: 'sign-in' });
  });

  // The one screen behind the session, so it is where a signed-in user is
  // sent from here.
  it('sends a signed-in user to the account screen', async () => {
    mockSession.current = {
      user: {
        id: 'user-id',
        email: 'ada@example.com',
      } as StoredSession['user'],
    };
    await renderRouter(routes);

    expect(screen.getByText(/signed in as ada@example\.com/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'sign out' })).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: 'Sign up' })).toBeNull();

    await fireEvent.press(
      screen.getByRole('link', { name: 'Go to your account' }),
    );

    expect(screen).toHavePathname('/account');
  });
});
