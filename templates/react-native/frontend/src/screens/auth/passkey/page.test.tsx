import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import RootLayout from '@/app/_layout';
import AuthLayout from '@/app/auth/_layout';
import PasskeySignIn from '@/app/auth/passkey/index';
import { nhost } from '@/lib/nhost/client';
import { passkeysOnThisDevice } from '@/screens/auth/passkey/thisDevice';
import { liveSession } from '@/test/session';

const mockAuth = {
  signInWebauthn: jest.fn(),
  verifySignInWebauthn: jest.fn(),
  signUpWebauthn: jest.fn(),
  verifySignUpWebauthn: jest.fn(),
};
const mockCeremony = {
  supported: true,
  startAuthentication: jest.fn(),
  startRegistration: jest.fn(),
};

jest.mock('@/lib/nhost/client', () => {
  const actual = jest.requireActual('@/lib/nhost/client');
  for (const name of [
    'signInWebauthn',
    'verifySignInWebauthn',
    'signUpWebauthn',
    'verifySignUpWebauthn',
  ] as const) {
    actual.nhost.auth[name] = (...args: unknown[]) => mockAuth[name](...args);
  }
  return { ...actual, checkSession: async () => 'live' };
});
jest.mock('@/screens/auth/passkey/ceremony', () => ({
  supportsPasskeys: () => mockCeremony.supported,
  startAuthentication: (...args: unknown[]) =>
    mockCeremony.startAuthentication(...args),
  startRegistration: (...args: unknown[]) =>
    mockCeremony.startRegistration(...args),
}));

const routes = {
  _layout: RootLayout,
  index: () => <Text>home</Text>,
  'account/index': () => <Text>account</Text>,
  'auth/_layout': AuthLayout,
  'auth/passkey/index': PasskeySignIn,
};

const open = (initialUrl: string) => renderRouter(routes, { initialUrl });

const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));

const saved = process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN;

beforeEach(() => {
  process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN = 'example.com';
  nhost.sessionStorage.remove();
  mockCeremony.supported = true;
  for (const fn of [
    ...Object.values(mockAuth),
    mockCeremony.startAuthentication,
    mockCeremony.startRegistration,
  ]) {
    fn.mockReset();
  }
});

afterEach(() => {
  if (saved === undefined) {
    delete process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN;
  } else {
    process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN = saved;
  }
});

describe('passkey screen', () => {
  // The ceremony is three steps in order, and the device's step sits between
  // the two server calls: options from the first, credential into the second.
  it('runs the sign-in ceremony and lands on next', async () => {
    const options = { challenge: 'c' };
    const credential = { id: 'cred' };
    mockAuth.signInWebauthn.mockResolvedValueOnce({ body: options });
    mockCeremony.startAuthentication.mockResolvedValueOnce(credential);
    // The client stores the session a verify answers with; the mock stands in
    // for the request, so it stores it itself.
    mockAuth.verifySignInWebauthn.mockImplementationOnce(async () => {
      const session = liveSession();
      nhost.sessionStorage.set(session);
      return { body: { session } };
    });
    await open('/auth/passkey?next=%2Faccount&intent=sign-in');

    await press('Sign in with a passkey');

    expect(mockCeremony.startAuthentication).toHaveBeenCalledWith(options);
    expect(mockAuth.verifySignInWebauthn).toHaveBeenCalledWith({ credential });
    expect(passkeysOnThisDevice().has('cred')).toBe(true);
    expect(screen).toHavePathname('/account');
  });

  it('says when the device has no passkey for the app', async () => {
    mockAuth.signInWebauthn.mockResolvedValueOnce({ body: {} });
    mockCeremony.startAuthentication.mockRejectedValueOnce({
      error: 'NoCredentials',
      message: '',
    });
    await open('/auth/passkey?intent=sign-in');

    await press('Sign in with a passkey');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This device has no passkey for this app.',
    );
  });

  it('registers a passkey and waits for the verification link', async () => {
    mockAuth.signUpWebauthn.mockResolvedValueOnce({ body: { challenge: 'c' } });
    mockCeremony.startRegistration.mockResolvedValueOnce({ id: 'new' });
    mockAuth.verifySignUpWebauthn.mockResolvedValueOnce({ body: {} });
    await open('/auth/passkey');

    await fireEvent.changeText(
      screen.getByLabelText('Email'),
      'ada@example.com',
    );
    await press('Create a passkey');

    expect(mockAuth.signUpWebauthn).toHaveBeenCalledWith({
      email: 'ada@example.com',
    });
    expect(mockCeremony.startRegistration).toHaveBeenCalledWith({
      challenge: 'c',
    });
    expect(
      screen.getByText(/^Your passkey is registered\. We sent a verification/),
    ).toBeOnTheScreen();
    expect(passkeysOnThisDevice().has('new')).toBe(true);
  });

  it('says the prompt was cancelled', async () => {
    mockAuth.signInWebauthn.mockResolvedValueOnce({ body: {} });
    mockCeremony.startAuthentication.mockRejectedValueOnce({
      error: 'UserCancelled',
      message: '',
    });
    await open('/auth/passkey?intent=sign-in');

    await press('Sign in with a passkey');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The passkey prompt was cancelled.',
    );
    expect(mockAuth.verifySignInWebauthn).not.toHaveBeenCalled();
  });

  it('asks nothing of a device without passkeys', async () => {
    mockCeremony.supported = false;
    await open('/auth/passkey?intent=sign-in');

    await press('Sign in with a passkey');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This device does not support passkeys.',
    );
    expect(mockAuth.signInWebauthn).not.toHaveBeenCalled();
  });

  // Reached only by typing its link, with passkeys off.
  it('is not there without a passkey domain', async () => {
    delete process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN;

    await open('/auth/passkey');

    expect(screen.getByText('This page could not be found.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Email')).toBeNull();
  });
});
