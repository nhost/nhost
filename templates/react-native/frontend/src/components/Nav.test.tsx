import type { StoredSession } from '@nhost/nhost-js/session';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import Nav from '@/components/Nav';

const mockSession = { current: null as Pick<StoredSession, 'user'> | null };

jest.mock('@/lib/nhost/AuthProvider', () => ({
  useSession: () => mockSession.current,
}));

// A made-up method, so this test names no real one's screens.
jest.mock('@/screens/signin/methods', () => ({
  methods: [{ signedOutPaths: ['/auth/method/finish'] }],
}));

function Screen() {
  return <Nav />;
}

const routes = {
  index: Screen,
  'signin/index': Screen,
  'account/index': Screen,
  'auth/method/finish/index': Screen,
};

const signedIn = (displayName: string) => {
  mockSession.current = {
    user: { displayName } as StoredSession['user'],
  };
};

beforeEach(() => {
  mockSession.current = null;
});

describe('Nav', () => {
  it('offers a signed-out visitor both ways in', async () => {
    await renderRouter(routes);

    expect(screen.queryByRole('link', { name: 'Your account' })).toBeNull();

    await fireEvent.press(screen.getByRole('link', { name: 'Sign in' }));

    expect(screen).toHavePathname('/signin');
    expect(screen).toHaveSearchParams({ intent: 'sign-in' });

    await fireEvent.press(screen.getByRole('link', { name: 'Sign up' }));

    expect(screen).toHavePathname('/signin');
    expect(screen).toHaveSearchParams({});
  });

  it('links home from the mark', async () => {
    await renderRouter(routes, { initialUrl: '/signin' });

    await fireEvent.press(screen.getByRole('link', { name: 'Nhost' }));

    expect(screen).toHavePathname('/');
  });

  it('links a signed-in visitor to their account by their initial', async () => {
    signedIn('ada');
    await renderRouter(routes);

    expect(screen.getByRole('button', { name: 'Sign out' })).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sign up' })).toBeNull();

    const account = screen.getByRole('link', { name: 'Your account' });
    expect(account).toHaveTextContent('A');

    await fireEvent.press(account);

    expect(screen).toHavePathname('/account');
  });

  // A reset link signs the visitor in only so the new password can be saved;
  // until then the nav should not say they are signed in.
  it('looks signed out on a method screen that asks for it', async () => {
    signedIn('Ada');
    await renderRouter(routes, { initialUrl: '/auth/method/finish' });

    expect(screen.queryByRole('link', { name: 'Your account' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeOnTheScreen();
  });

  it('shows a dot for an account without a display name', async () => {
    signedIn(' ');
    await renderRouter(routes);

    expect(
      screen.getByRole('link', { name: 'Your account' }),
    ).toHaveTextContent('·');
  });
});
