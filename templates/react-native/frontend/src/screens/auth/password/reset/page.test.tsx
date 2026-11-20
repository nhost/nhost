import { router } from 'expo-router';
import {
  act,
  fireEvent,
  renderRouter,
  screen,
} from 'expo-router/testing-library';
import { Text } from 'react-native';
import RootLayout from '@/app/_layout';
import AuthLayout from '@/app/auth/_layout';
import Password from '@/app/auth/password/index';
import ResetPasswordLayout from '@/app/auth/password/reset/_layout';
import ResetPassword from '@/app/auth/password/reset/index';
import { nhost } from '@/lib/nhost/client';
import {
  pendingPasswordReset,
  startPasswordReset,
} from '@/lib/nhost/passwordReset';
import { liveSession } from '@/test/session';

const mockChangeUserPassword = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@/lib/nhost/client', () => {
  const actual = jest.requireActual('@/lib/nhost/client');
  actual.nhost.auth.changeUserPassword = (body: unknown) =>
    mockChangeUserPassword(body);
  actual.nhost.auth.signOut = (body: unknown) => mockSignOut(body);
  return { ...actual, checkSession: async () => 'live' };
});

const RESET = '/auth/password/reset';

const routes = {
  _layout: RootLayout,
  index: () => <Text>home</Text>,
  'account/index': () => <Text>account</Text>,
  'auth/_layout': AuthLayout,
  'auth/password/index': Password,
  'auth/password/reset/_layout': ResetPasswordLayout,
  'auth/password/reset/index': ResetPassword,
};

const open = (initialUrl = RESET) => renderRouter(routes, { initialUrl });

const signIn = () =>
  nhost.sessionStorage.set(
    liveSession({
      user: {
        id: 'user-id',
        displayName: 'Ada',
        email: 'ada@example.com',
      } as never,
    }),
  );

async function choose(password: string): Promise<void> {
  await fireEvent.changeText(screen.getByLabelText('New password'), password);
  await fireEvent.changeText(
    screen.getByLabelText('Confirm new password'),
    password,
  );
}

// What the main client does on a successful change or sign-out: auth has
// revoked the session, so the client drops it.
const clearsSession = async () => {
  nhost.sessionStorage.remove();
  return { body: 'OK' };
};

beforeEach(() => {
  nhost.sessionStorage.remove();
  mockChangeUserPassword.mockReset();
  mockSignOut.mockReset();
});

describe('password reset screen', () => {
  // Only the sign-in mode offers to send a reset link, and the form opens on
  // sign up without an intent.
  it('asks a signed-out visitor for a new link, on the form that can send one', async () => {
    await open();

    expect(screen.getByText('This link no longer works')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveProp(
      'href',
      '/auth/password?intent=sign-in',
    );
  });

  // A reset link's session: the guard keeps it here until a password is
  // saved, across relaunches, since the marker is stored with the session.
  it('keeps a reset link session on the screen', async () => {
    signIn();
    startPasswordReset(RESET);

    await open('/account');

    expect(screen).toHavePathname(RESET);
    expect(screen.getByText('Choose a new password')).toBeOnTheScreen();
    expect(
      screen.getByText(/You are signed in as ada@example\.com/),
    ).toBeOnTheScreen();
  });

  // VoiceOver reads `accessibilityLabel` and ignores `aria-labelledby`, so
  // without it the two fields would be identical unnamed secure fields.
  it('names both password fields for VoiceOver', async () => {
    signIn();
    startPasswordReset(RESET);

    await open();

    expect(screen.getByLabelText('New password')).toHaveProp(
      'accessibilityLabel',
      'New password',
    );
    expect(screen.getByLabelText('Confirm new password')).toHaveProp(
      'accessibilityLabel',
      'Confirm new password',
    );
  });

  // A reset link opened while signed in is discarded on arrival and lands
  // here with no reset under way: as on the web, the visitor may still set a
  // password, but nothing holds them here.
  it('lets a signed-in visitor without a reset choose a password, or leave', async () => {
    signIn();

    await open();

    expect(screen).toHavePathname(RESET);
    expect(pendingPasswordReset()).toBeNull();
    expect(screen.getByText('Choose a new password')).toBeOnTheScreen();
    expect(
      screen.getByText(/You are signed in as ada@example\.com/),
    ).toBeOnTheScreen();

    await act(async () => router.push('/account'));

    expect(screen).toHavePathname('/account');
  });

  it('keeps the changed card once the save has cleared the session', async () => {
    signIn();
    startPasswordReset(RESET);
    mockChangeUserPassword.mockImplementationOnce(clearsSession);
    await open();

    await choose('a new password');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Save password' }),
    );

    expect(mockChangeUserPassword).toHaveBeenCalledWith({
      newPassword: 'a new password',
    });
    expect(nhost.getUserSession()).toBeNull();
    expect(pendingPasswordReset()).toBeNull();
    expect(screen.getByText('Password changed')).toBeOnTheScreen();
    expect(screen.queryByText('This link no longer works')).toBeNull();

    // The nav has a sign-in link of its own, to the list.
    const signInAgain = screen
      .getAllByRole('link', { name: 'Sign in' })
      .find((link) => link.props.href === '/auth/password?intent=sign-in');
    expect(signInAgain).toBeDefined();
    await fireEvent.press(signInAgain as NonNullable<typeof signInAgain>);

    expect(screen).toHavePathname('/auth/password');
    expect(screen).toHaveSearchParams({ intent: 'sign-in' });
  });

  // The guard keeps a reset link's session here until a password is saved,
  // so this is the one way off it without one.
  it('signs out and goes home on cancel', async () => {
    signIn();
    startPasswordReset(RESET);
    mockSignOut.mockImplementationOnce(clearsSession);
    await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockSignOut).toHaveBeenCalledWith({
      refreshToken: 'refresh-token',
    });
    expect(mockChangeUserPassword).not.toHaveBeenCalled();
    expect(pendingPasswordReset()).toBeNull();
    expect(screen).toHavePathname('/');
  });
});
