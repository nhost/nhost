import type {
  CredentialAssertionResponse,
  CredentialCreationResponse,
} from '@nhost/nhost-js/auth';
import { readFlows } from '@/lib/nhost/links';
import { codeChallenge } from '@/lib/nhost/pkce';
import {
  beginSignUp,
  finishSignIn,
  finishSignUp,
} from '@/screens/auth/passkey/actions';

const mockAuth = {
  signUpWebauthn: jest.fn(),
  verifySignUpWebauthn: jest.fn(),
  signInWebauthn: jest.fn(),
  verifySignInWebauthn: jest.fn(),
};

jest.mock('@/lib/nhost/client', () => ({
  ...jest.requireActual('@/lib/nhost/client'),
  nhost: {
    auth: {
      signUpWebauthn: (...args: unknown[]) => mockAuth.signUpWebauthn(...args),
      verifySignUpWebauthn: (...args: unknown[]) =>
        mockAuth.verifySignUpWebauthn(...args),
      signInWebauthn: (...args: unknown[]) => mockAuth.signInWebauthn(...args),
      verifySignInWebauthn: (...args: unknown[]) =>
        mockAuth.verifySignInWebauthn(...args),
    },
  },
}));

// Stand-ins: the actions pass these through untouched, so their shape is the
// backend's concern.
const creation = { id: 'cred' } as unknown as CredentialCreationResponse;
const assertion = { id: 'cred' } as unknown as CredentialAssertionResponse;

type Verify = {
  nickname?: string;
  options: { redirectTo: string };
  codeChallenge: string;
};

const verified = (): Verify => mockAuth.verifySignUpWebauthn.mock.calls[0][0];

beforeEach(() => {
  for (const fn of Object.values(mockAuth)) {
    fn.mockReset();
  }
});

describe('finishSignUp', () => {
  // The verify is what sends the verification email, and its link signs in
  // only with the verifier this device kept.
  it('asks for a verification link only this device can sign in with', async () => {
    mockAuth.verifySignUpWebauthn.mockResolvedValueOnce({ body: {} });

    expect(await finishSignUp(creation, '/account?tab=1')).toEqual({
      signedIn: false,
    });

    const [flow] = readFlows();
    expect(flow).toMatchObject({ kind: 'emailVerify' });
    expect(verified().options.redirectTo).toBe(
      `nhost-starter://account?tab=1&flow=${flow?.id}`,
    );
    expect(verified().codeChallenge).toBe(
      await codeChallenge(flow?.verifier ?? ''),
    );
  });

  it('keeps the link in this app whatever next it is given', async () => {
    for (const hostile of ['//evil.example/', 'https://evil.example', '.']) {
      mockAuth.verifySignUpWebauthn.mockReset();
      mockAuth.verifySignUpWebauthn.mockResolvedValueOnce({ body: {} });

      await finishSignUp(creation, hostile);

      expect(verified().options.redirectTo).toMatch(
        /^nhost-starter:\/\/account\?flow=[\w-]+$/,
      );
    }
  });

  it('names the first passkey', async () => {
    mockAuth.verifySignUpWebauthn.mockResolvedValueOnce({ body: {} });

    await finishSignUp(creation, '/', ' Pixel 8 - Android ');

    expect(verified().nickname).toBe('Pixel 8 - Android');
  });

  it('signs in at once when auth answers with a session', async () => {
    mockAuth.verifySignUpWebauthn.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    expect(await finishSignUp(creation, '/')).toEqual({ signedIn: true });
  });
});

describe('beginSignUp', () => {
  it('sends the address alone, the redirect going with the verify', async () => {
    mockAuth.signUpWebauthn.mockResolvedValueOnce({ body: { challenge: 'c' } });

    expect(await beginSignUp('ada@example.com')).toEqual({
      options: { challenge: 'c' },
    });
    expect(mockAuth.signUpWebauthn).toHaveBeenCalledWith({
      email: 'ada@example.com',
    });
  });
});

describe('finishSignIn', () => {
  it('succeeds when a session came back', async () => {
    mockAuth.verifySignInWebauthn.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    expect(await finishSignIn(assertion)).toEqual({ success: true });
  });

  it('says the passkey is not registered when auth rejects it', async () => {
    mockAuth.verifySignInWebauthn.mockRejectedValueOnce({
      status: 400,
      body: { error: 'invalid-request' },
    });

    expect((await finishSignIn(assertion)).error).toMatch(
      /^That passkey is not registered with this app/,
    );
  });

  it('says to wait when auth rate-limits', async () => {
    mockAuth.verifySignInWebauthn.mockRejectedValueOnce({
      status: 429,
      message: '',
    });

    expect(await finishSignIn(assertion)).toEqual({
      error: 'Could not sign in: Too many attempts. Try again in 5 minutes.',
    });
  });
});
