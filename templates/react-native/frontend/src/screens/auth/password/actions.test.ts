import { readFlows } from '@/lib/nhost/links';
import { codeChallenge } from '@/lib/nhost/pkce';
import {
  requestPasswordReset,
  setNewPassword,
  signIn,
  signUp,
  verifyMfa,
} from '@/screens/auth/password/actions';

type Linked = { options: { redirectTo: string }; codeChallenge: string };

const mockAuth = {
  signInEmailPassword: jest.fn(),
  verifySignInMfaTotp: jest.fn(),
  signUpEmailPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  changeUserPassword: jest.fn(),
};
const mockEndPasswordReset = jest.fn();
let mockSession: object | null = { user: { id: 'user-id' } };

jest.mock('@/lib/nhost/client', () => ({
  ...jest.requireActual('@/lib/nhost/client'),
  nhost: {
    get auth() {
      return mockAuth;
    },
    getUserSession: () => mockSession,
  },
}));
jest.mock('@/lib/nhost/passwordReset', () => ({
  ...jest.requireActual('@/lib/nhost/passwordReset'),
  endPasswordReset: () => mockEndPasswordReset(),
}));

const sent = (mock: jest.Mock): Linked => mock.mock.calls[0][0];

beforeEach(() => {
  for (const fn of [...Object.values(mockAuth), mockEndPasswordReset]) {
    fn.mockReset();
  }
  mockSession = { user: { id: 'user-id' } };
});

describe('signUp', () => {
  beforeEach(() => {
    mockAuth.signUpEmailPassword.mockResolvedValue({ body: { session: null } });
  });

  // The verification link signs in: its code is good only with the verifier
  // this device kept.
  it('asks for a verification link that only this device can sign in with', async () => {
    expect(
      await signUp('user@example.com', 'correct horse', '/account?tab=1'),
    ).toEqual({ success: true, signedIn: false });

    const [flow] = readFlows();
    expect(flow).toMatchObject({ kind: 'emailVerify' });
    expect(sent(mockAuth.signUpEmailPassword).options.redirectTo).toBe(
      `nhost-starter://account?tab=1&flow=${flow?.id}`,
    );
    expect(sent(mockAuth.signUpEmailPassword).codeChallenge).toBe(
      await codeChallenge(flow?.verifier ?? ''),
    );
  });

  // Anything can call it, so `next` here is whatever the caller sent.
  it('keeps the verification link in this app whatever next it is given', async () => {
    for (const hostile of ['//evil.example/', 'https://evil.example', '.']) {
      mockAuth.signUpEmailPassword.mockClear();

      await signUp('user@example.com', 'correct horse', hostile);

      expect(sent(mockAuth.signUpEmailPassword).options.redirectTo).toMatch(
        /^nhost-starter:\/\/account\?flow=[\w-]+$/,
      );
    }
  });

  it('reports a backend with verification off as signed in', async () => {
    mockAuth.signUpEmailPassword.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    expect(await signUp('user@example.com', 'correct horse', '/')).toEqual({
      success: true,
      signedIn: true,
    });
  });

  // Auth would answer with a bare schema error, or a 500 once bcrypt refuses
  // more than 72 bytes.
  it('refuses a password auth would refuse, without asking it', async () => {
    for (const password of ['short', 'a'.repeat(51), 'é'.repeat(37)]) {
      expect((await signUp('user@example.com', password, '/')).error).toMatch(
        /^Use /,
      );
    }
    expect(mockAuth.signUpEmailPassword).not.toHaveBeenCalled();
    expect(readFlows()).toEqual([]);
  });
});

describe('requestPasswordReset', () => {
  it('asks for a reset link back to the reset screen, for this device only', async () => {
    mockAuth.sendPasswordResetEmail.mockResolvedValueOnce({ body: 'OK' });

    expect(await requestPasswordReset('user@example.com')).toEqual({
      success: true,
    });

    const [flow] = readFlows();
    expect(flow).toMatchObject({ kind: 'passwordReset' });
    expect(sent(mockAuth.sendPasswordResetEmail)).toEqual({
      email: 'user@example.com',
      options: {
        redirectTo: `nhost-starter://auth/password/reset?flow=${flow?.id}`,
      },
      codeChallenge: await codeChallenge(flow?.verifier ?? ''),
    });
  });

  it('names the email limit when auth refuses for the rate', async () => {
    mockAuth.sendPasswordResetEmail.mockRejectedValueOnce({
      status: 429,
      message: '',
    });

    expect(await requestPasswordReset('user@example.com')).toEqual({
      error:
        'Could not send the reset link: Too many attempts. Try again in an hour.',
    });
  });
});

describe('signIn', () => {
  it('answers a password no account can have as a wrong one', async () => {
    for (const password of ['ab', 'a'.repeat(51)]) {
      expect(await signIn('user@example.com', password)).toEqual({
        error: 'Could not sign in: Incorrect email or password',
      });
    }
    expect(mockAuth.signInEmailPassword).not.toHaveBeenCalled();
  });

  it('sends the address without surrounding spaces', async () => {
    mockAuth.signInEmailPassword.mockResolvedValue({
      body: { session: { accessToken: 'token' } },
    });

    await signIn(' user@example.com ', 'correct horse');

    expect(mockAuth.signInEmailPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'correct horse',
    });
  });

  // An account with two-factor on gets a ticket back instead of a session.
  // The sign-in is not over until `verifyMfa` trades it for one.
  it('hands back the ticket when two-factor is on', async () => {
    mockAuth.signInEmailPassword.mockResolvedValueOnce({
      body: { mfa: { ticket: 'mfaTotp:abc' } },
    });

    expect(await signIn('user@example.com', 'password')).toEqual({
      mfaTicket: 'mfaTotp:abc',
    });
  });
});

describe('verifyMfa', () => {
  it('trades the ticket and code for a session', async () => {
    mockAuth.verifySignInMfaTotp.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    expect(await verifyMfa('mfaTotp:abc', '123456')).toEqual({
      success: true,
    });
    expect(mockAuth.verifySignInMfaTotp).toHaveBeenCalledWith({
      ticket: 'mfaTotp:abc',
      otp: '123456',
    });
  });
});

describe('setNewPassword', () => {
  // Saving the password is what lets a reset link's session leave the screen.
  it('ends the reset once the password is changed', async () => {
    mockAuth.changeUserPassword.mockResolvedValueOnce({});

    expect(await setNewPassword('a new password')).toEqual({ success: true });
    expect(mockEndPasswordReset).toHaveBeenCalledTimes(1);
  });

  it('keeps the reset going when the password would be refused', async () => {
    expect((await setNewPassword('é'.repeat(37))).error).toMatch(/^Use /);
    expect(mockAuth.changeUserPassword).not.toHaveBeenCalled();
    expect(mockEndPasswordReset).not.toHaveBeenCalled();
  });

  it('asks for another link once the session is gone', async () => {
    mockSession = null;

    expect(await setNewPassword('a new password')).toEqual({
      error: 'The reset link has expired. Request another.',
    });
    expect(mockAuth.changeUserPassword).not.toHaveBeenCalled();
  });
});
