import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import RootLayout from '@/app/_layout';
import AuthLayout from '@/app/auth/_layout';
import Password from '@/app/auth/password/index';
import { nhost } from '@/lib/nhost/client';
import { liveSession } from '@/test/session';

const mockAuth = {
  signInEmailPassword: jest.fn(),
  verifySignInMfaTotp: jest.fn(),
  signUpEmailPassword: jest.fn(),
};

jest.mock('@/lib/nhost/client', () => {
  const actual = jest.requireActual('@/lib/nhost/client');
  for (const name of [
    'signInEmailPassword',
    'verifySignInMfaTotp',
    'signUpEmailPassword',
  ] as const) {
    actual.nhost.auth[name] = (...args: unknown[]) => mockAuth[name](...args);
  }
  return { ...actual, checkSession: async () => 'live' };
});

const routes = {
  _layout: RootLayout,
  index: () => <Text>home</Text>,
  'account/index': () => <Text>account</Text>,
  'signin/index': () => <Text>sign-in list</Text>,
  'auth/_layout': AuthLayout,
  'auth/password/index': Password,
};

const open = (initialUrl: string) => renderRouter(routes, { initialUrl });

async function type(label: string, value: string): Promise<void> {
  await fireEvent.changeText(screen.getByLabelText(label), value);
}

// The client stores the session a sign-in answers with; the mocks stand in
// for the request, so they store it themselves.
const signedIn = () => {
  const session = liveSession();
  nhost.sessionStorage.set(session);
  return { body: { session } };
};

beforeEach(() => {
  nhost.sessionStorage.remove();
  for (const fn of Object.values(mockAuth)) {
    fn.mockReset();
  }
});

describe('password screen', () => {
  it('opens on sign-up, with the rules a new password has to meet', async () => {
    await open('/auth/password');

    expect(screen.getByRole('button', { name: 'Sign up' })).toBeDisabled();
    expect(
      screen.getByLabelText('9 to 50 characters, not met'),
    ).toBeOnTheScreen();

    await type('Email', 'ada@example.com');
    await type('Password', 'correct horse');

    expect(screen.getByLabelText('9 to 50 characters, met')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeEnabled();
  });

  it('sends a verification link that comes back to next', async () => {
    mockAuth.signUpEmailPassword.mockResolvedValueOnce({
      body: { session: null },
    });
    await open('/auth/password?next=%2Faccount%3Ftab%3D1');

    await type('Email', 'ada@example.com');
    await type('Password', 'correct horse');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));

    expect(mockAuth.signUpEmailPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        options: {
          redirectTo: expect.stringMatching(
            /^nhost-starter:\/\/account\?tab=1&flow=/,
          ),
        },
        codeChallenge: expect.any(String),
      }),
    );
    expect(
      screen.getByText(/verification link to ada@example\.com/),
    ).toBeOnTheScreen();
  });

  // "Other ways to sign in" is built from the params, so a mode the visitor
  // switched to only reaches it through them.
  it('writes the mode it switched to into the params, keeping next', async () => {
    await open('/auth/password?next=%2Fprotected');

    await fireEvent.press(
      screen.getByRole('button', { name: 'I already have an account' }),
    );

    expect(screen).toHaveSearchParams({
      next: '/protected',
      intent: 'sign-in',
    });
    expect(
      screen.getByRole('link', { name: 'Other ways to sign in' }),
    ).toHaveProp('href', '/signin?next=%2Fprotected&intent=sign-in');

    await fireEvent.press(
      screen.getByRole('button', { name: 'Create an account' }),
    );

    expect(screen).toHaveSearchParams({ next: '/protected' });
  });

  it('signs in and goes on to next', async () => {
    mockAuth.signInEmailPassword.mockImplementationOnce(async () => signedIn());
    await open('/auth/password?intent=sign-in');

    await type('Email', 'ada@example.com');
    await type('Password', 'correct horse');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen).toHavePathname('/account');
    expect(screen.getByText('account')).toBeOnTheScreen();
  });

  it('asks for the code, then trades it for the session', async () => {
    mockAuth.signInEmailPassword.mockResolvedValueOnce({
      body: { mfa: { ticket: 'mfaTotp:abc' } },
    });
    mockAuth.verifySignInMfaTotp.mockImplementationOnce(async () => signedIn());
    await open('/auth/password?intent=sign-in');
    await type('Email', 'ada@example.com');
    await type('Password', 'correct horse');

    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(screen).toHavePathname('/auth/password');

    await type('Authenticator code', '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify' }));

    expect(mockAuth.verifySignInMfaTotp).toHaveBeenCalledWith({
      ticket: 'mfaTotp:abc',
      otp: '123456',
    });
    expect(screen).toHavePathname('/account');
  });

  // Auth spends the ticket on the first attempt, even a wrong one, so a retry
  // on the same ticket could never succeed.
  it('signs in again for a fresh ticket after a wrong code', async () => {
    mockAuth.signInEmailPassword
      .mockResolvedValueOnce({ body: { mfa: { ticket: 'mfaTotp:first' } } })
      .mockResolvedValueOnce({ body: { mfa: { ticket: 'mfaTotp:second' } } });
    mockAuth.verifySignInMfaTotp
      .mockRejectedValueOnce({ status: 401, message: 'Invalid TOTP' })
      .mockImplementationOnce(async () => signedIn());
    await open('/auth/password?intent=sign-in');
    await type('Email', 'ada@example.com');
    await type('Password', 'correct horse');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    await type('Authenticator code', '000000');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Invalid TOTP$/);
    expect(screen).toHavePathname('/auth/password');

    await type('Authenticator code', '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify' }));

    expect(mockAuth.signInEmailPassword).toHaveBeenLastCalledWith({
      email: 'ada@example.com',
      password: 'correct horse',
    });
    expect(mockAuth.verifySignInMfaTotp).toHaveBeenLastCalledWith({
      ticket: 'mfaTotp:second',
      otp: '123456',
    });
    expect(screen).toHavePathname('/account');
  });

  it('sends a signed-in visitor on to next', async () => {
    nhost.sessionStorage.set(liveSession());

    await open('/auth/password?next=%2Faccount');

    expect(screen).toHavePathname('/account');
    expect(screen.queryByLabelText('Email')).toBeNull();
  });
});
