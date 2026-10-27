import type {
  CredentialAssertionResponse,
  CredentialCreationResponse,
} from '@nhost/nhost-js/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { finishSignIn, finishSignUp } from '@/app/auth/passkey/actions';
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

const _options = { challenge: 'c' };
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

      await finishSignUp(creation, hostile);

      expect(redirectOf(auth.verifySignUpWebauthn)).toBe(
        `${appOrigin()}${DEFAULT_DESTINATION}`,
      );
    }
  });
});

describe('finishSignIn', () => {
  it('succeeds when a session came back', async () => {
    auth.verifySignInWebauthn.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    expect(await finishSignIn(assertion)).toEqual({ success: true });
  });
});
