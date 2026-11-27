import type {
  CredentialAssertionResponse,
  CredentialCreationResponse,
} from '@nhost/nhost-js/auth';
import { FetchError } from '@nhost/nhost-js/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appOrigin } from '#lib/nhost/env.server.ts';
import { DEFAULT_DESTINATION } from '#routes/signin/destination.ts';
import { finishSignIn, finishSignUp } from './actions.remote.ts';

vi.mock('$app/server', () => import('#lib/testing/appServer.ts'));

const auth = vi.hoisted(() => ({
  signUpWebauthn: vi.fn(),
  verifySignUpWebauthn: vi.fn(),
  signInWebauthn: vi.fn(),
  verifySignInWebauthn: vi.fn(),
}));

vi.mock('#lib/nhost/server.ts', () => ({
  createNhostClient: () => ({ auth }),
}));

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

// Both halves of sign-up send `redirectTo`, since the verify is what sends the
// verification email.
describe('sign-up keeps the verification link on this origin', () => {
  it('in finishSignUp', async () => {
    for (const hostile of ['-attacker.example/', '//evil.example', '.evil']) {
      auth.verifySignUpWebauthn.mockReset();
      auth.verifySignUpWebauthn.mockResolvedValueOnce({ body: {} });

      await finishSignUp({ credential: creation, next: hostile });

      expect(redirectOf(auth.verifySignUpWebauthn)).toBe(
        `${appOrigin()}${DEFAULT_DESTINATION}`,
      );
    }
  });
});

describe('finishSignUp', () => {
  it('names the first passkey', async () => {
    auth.verifySignUpWebauthn.mockResolvedValueOnce({ body: {} });

    await finishSignUp({
      credential: creation,
      next: '/',
      nickname: ' Chrome - macOS ',
    });

    expect(auth.verifySignUpWebauthn.mock.calls[0][0].nickname).toBe(
      'Chrome - macOS',
    );
  });
});

describe('finishSignIn', () => {
  it('succeeds when a session came back', async () => {
    auth.verifySignInWebauthn.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    expect(await finishSignIn(assertion)).toEqual({ success: true });
  });

  it('says the passkey is not registered when auth rejects it', async () => {
    auth.verifySignInWebauthn.mockRejectedValueOnce(
      new FetchError({ error: 'invalid-request' }, 400, new Headers()),
    );

    expect((await finishSignIn(assertion)).error).toMatch(
      /^That passkey is not registered with this app/,
    );
  });

  it('says to wait when auth rate-limits', async () => {
    auth.verifySignInWebauthn.mockRejectedValueOnce(
      new FetchError('', 429, new Headers()),
    );

    expect(await finishSignIn(assertion)).toEqual({
      error: 'Could not sign in: Too many attempts. Try again in 5 minutes.',
    });
  });
});
