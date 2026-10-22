import type {
  CredentialAssertionResponse,
  CredentialCreationResponse,
} from '@nhost/nhost-js/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginSignIn,
  beginSignUp,
  finishSignIn,
  finishSignUp,
} from '@/app/auth/passkey/actions';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { appOrigin } from '@/lib/nhost/env';

const auth = vi.hoisted(() => ({
  signUpWebauthn: vi.fn(),
  verifySignUpWebauthn: vi.fn(),
  signInWebauthn: vi.fn(),
  verifySignInWebauthn: vi.fn(),
}));

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({ auth }),
}));

const options = { challenge: 'c' };
// Stand-ins: the actions pass these through untouched, so their shape is the
// backend's concern.
const creation = { id: 'cred' } as unknown as CredentialCreationResponse;
const assertion = { id: 'cred' } as unknown as CredentialAssertionResponse;

const redirectOf = (fn: ReturnType<typeof vi.fn>): string =>
  fn.mock.calls[0][0].options.redirectTo;

beforeEach(() => {
  for (const fn of Object.values(auth)) {
    fn.mockReset();
  }
});

describe('beginSignUp', () => {
  it('asks for an email before calling the backend', async () => {
    expect(await beginSignUp('', '/')).toEqual({ error: 'Email is required.' });
    expect(auth.signUpWebauthn).not.toHaveBeenCalled();
  });

  it('returns the creation options the backend issued', async () => {
    auth.signUpWebauthn.mockResolvedValueOnce({ body: options });

    expect(await beginSignUp('user@example.com', '/')).toEqual({ options });
  });
});

// Both halves of sign-up send `redirectTo`, since the verify is what sends
// the verification email. Each is callable without the page, so `next` here
// is whatever the caller sent, and appended to the origin a hostile value
// would change the host the link points at.
describe('sign-up keeps the verification link on this origin', () => {
  it('in beginSignUp', async () => {
    for (const hostile of ['-attacker.example/', '//evil.example', '.evil']) {
      auth.signUpWebauthn.mockReset();
      auth.signUpWebauthn.mockResolvedValueOnce({ body: options });

      await beginSignUp('user@example.com', hostile);

      expect(redirectOf(auth.signUpWebauthn)).toBe(
        `${appOrigin()}${DEFAULT_DESTINATION}`,
      );
    }
  });

  it('in finishSignUp', async () => {
    for (const hostile of ['-attacker.example/', '//evil.example', '.evil']) {
      auth.verifySignUpWebauthn.mockReset();
      auth.verifySignUpWebauthn.mockResolvedValueOnce({ body: {} });

      await finishSignUp(creation, hostile);

      expect(redirectOf(auth.verifySignUpWebauthn)).toBe(
        `${appOrigin()}${DEFAULT_DESTINATION}`,
      );
    }
  });

  it('and carries a real path through', async () => {
    auth.verifySignUpWebauthn.mockResolvedValueOnce({ body: {} });

    await finishSignUp(creation, '/protected');

    expect(redirectOf(auth.verifySignUpWebauthn)).toBe(
      `${appOrigin()}/protected`,
    );
  });
});

describe('finishSignUp', () => {
  it('reports signedIn from whether a session came back', async () => {
    auth.verifySignUpWebauthn.mockResolvedValueOnce({ body: {} });
    expect(await finishSignUp(creation, '/')).toEqual({ signedIn: false });

    auth.verifySignUpWebauthn.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });
    expect(await finishSignUp(creation, '/')).toEqual({ signedIn: true });
  });
});

describe('beginSignIn', () => {
  it('asks the backend for options without an email', async () => {
    auth.signInWebauthn.mockResolvedValueOnce({ body: options });

    expect(await beginSignIn()).toEqual({ options });
    expect(auth.signInWebauthn).toHaveBeenCalledWith();
  });
});

describe('finishSignIn', () => {
  it('treats a response without a session as a refused passkey', async () => {
    auth.verifySignInWebauthn.mockResolvedValueOnce({ body: {} });

    expect(await finishSignIn(assertion)).toEqual({
      error: 'That passkey was not accepted.',
    });
  });

  it('succeeds when a session came back', async () => {
    auth.verifySignInWebauthn.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    expect(await finishSignIn(assertion)).toEqual({ success: true });
  });

  it('reports a backend error instead of throwing', async () => {
    auth.verifySignInWebauthn.mockRejectedValueOnce(new Error('bad signature'));

    expect(await finishSignIn(assertion)).toEqual({
      error: 'Could not sign in: bad signature',
    });
  });
});
