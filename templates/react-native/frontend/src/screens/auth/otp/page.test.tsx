import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import RootLayout from '@/app/_layout';
import AuthLayout from '@/app/auth/_layout';
import OtpSignIn from '@/app/auth/otp/index';
import { nhost } from '@/lib/nhost/client';
import { WRONG_CODE } from '@/screens/auth/otp/actions';
import { liveSession } from '@/test/session';

const mockAuth = {
  signInOTPEmail: jest.fn(),
  verifySignInOTPEmail: jest.fn(),
};

jest.mock('@/lib/nhost/client', () => {
  const actual = jest.requireActual('@/lib/nhost/client');
  for (const name of ['signInOTPEmail', 'verifySignInOTPEmail'] as const) {
    actual.nhost.auth[name] = (...args: unknown[]) => mockAuth[name](...args);
  }
  return { ...actual, checkSession: async () => 'live' };
});

const routes = {
  _layout: RootLayout,
  index: () => <Text>home</Text>,
  'account/index': () => <Text>account</Text>,
  'auth/_layout': AuthLayout,
  'auth/otp/index': OtpSignIn,
};

const open = (initialUrl: string) => renderRouter(routes, { initialUrl });

async function type(label: string, value: string): Promise<void> {
  await fireEvent.changeText(screen.getByLabelText(label), value);
}

const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));

// The client stores the session a verify answers with; the mock stands in for
// the request, so it stores it itself.
const signedIn = () => {
  const session = liveSession();
  nhost.sessionStorage.set(session);
  return { body: { session } };
};

beforeEach(() => {
  nhost.sessionStorage.remove();
  mockAuth.signInOTPEmail.mockReset();
  mockAuth.signInOTPEmail.mockResolvedValue({});
  mockAuth.verifySignInOTPEmail.mockReset();
});

describe('email code screen', () => {
  it('sends a code, then signs in with the right one after a wrong one', async () => {
    mockAuth.verifySignInOTPEmail
      .mockRejectedValueOnce({ status: 400, body: { error: 'invalid-otp' } })
      .mockImplementationOnce(async () => signedIn());
    await open('/auth/otp?next=%2Faccount');

    await type('Email', 'ada@example.com');
    await press('Send me a code');

    expect(mockAuth.signInOTPEmail).toHaveBeenCalledWith({
      email: 'ada@example.com',
    });
    expect(
      screen.getByText('We sent a code to ada@example.com.'),
    ).toBeOnTheScreen();

    await type('Code', '111111');
    await press('Sign in');

    expect(screen.getByRole('alert')).toHaveTextContent(WRONG_CODE);
    expect(screen).toHavePathname('/auth/otp');

    await type('Code', '222222');
    await press('Sign in');

    expect(mockAuth.verifySignInOTPEmail).toHaveBeenLastCalledWith({
      email: 'ada@example.com',
      otp: '222222',
    });
    expect(screen).toHavePathname('/account');
  });

  // The keyboard can offer the code from the email, on both platforms.
  it('marks the code field as a one-time code', async () => {
    await open('/auth/otp');
    await type('Email', 'ada@example.com');
    await press('Send me a code');

    const code = screen.getByLabelText('Code');
    expect(code).toHaveProp('textContentType', 'oneTimeCode');
    expect(code).toHaveProp('autoComplete', 'one-time-code');
  });

  // Back in the app after reading the email, sending again would replace the
  // code it holds.
  it('takes a code already sent without sending another', async () => {
    await open('/auth/otp');
    await type('Email', 'ada@example.com');

    await press('I already have a code');

    expect(mockAuth.signInOTPEmail).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Code')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Enter the code from the most recent email we sent to ada@example.com.',
      ),
    ).toBeOnTheScreen();
  });

  it('checks the address before taking a code already sent', async () => {
    await open('/auth/otp');
    await type('Email', 'ada@');

    await press('I already have a code');

    expect(screen.queryByLabelText('Code')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a valid email address.',
    );
  });

  it('says earlier codes stop working once a new one is sent', async () => {
    await open('/auth/otp');
    await type('Email', 'ada@example.com');
    await press('Send me a code');

    await press('Send a new code');

    expect(mockAuth.signInOTPEmail).toHaveBeenCalledTimes(2);
    expect(
      screen.getByText(
        'We sent a new code to ada@example.com. Codes from earlier emails no longer work.',
      ),
    ).toBeOnTheScreen();
  });

  it('drops the spaces from a pasted code', async () => {
    await open('/auth/otp');
    await type('Email', 'ada@example.com');
    await press('Send me a code');

    await type('Code', ' 123 456\n');

    expect(screen.getByLabelText('Code')).toHaveDisplayValue('123456');
  });

  it('goes back to the address, keeping it', async () => {
    await open('/auth/otp');
    await type('Email', 'ada@example.com');
    await press('Send me a code');

    await press('Use a different address');

    expect(screen.getByLabelText('Email')).toHaveDisplayValue(
      'ada@example.com',
    );
  });

  it('sends a signed-in visitor on to next', async () => {
    nhost.sessionStorage.set(liveSession());

    await open('/auth/otp?next=%2Faccount');

    expect(screen).toHavePathname('/account');
    expect(screen.queryByLabelText('Email')).toBeNull();
  });
});
