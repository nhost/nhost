import { FetchError } from '@nhost/nhost-js/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signIn, verifyMfa } from '@/app/auth/password/actions';

const auth = vi.hoisted(() => ({
  signInEmailPassword: vi.fn(),
  verifySignInMfaTotp: vi.fn(),
}));

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({ auth }),
}));

beforeEach(() => {
  auth.signInEmailPassword.mockReset();
  auth.verifySignInMfaTotp.mockReset();
});

// An account with two-factor on gets a ticket back instead of a session. The
// sign-in is not over until `verifyMfa` trades it for one.
describe('signIn with two-factor on', () => {
  it('hands back the ticket instead of a session', async () => {
    auth.signInEmailPassword.mockResolvedValueOnce({
      body: { mfa: { ticket: 'mfaTotp:abc' } },
    });

    expect(await signIn('user@example.com', 'password')).toEqual({
      mfaTicket: 'mfaTotp:abc',
    });
  });

  it('still succeeds outright when a session came back', async () => {
    auth.signInEmailPassword.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    expect(await signIn('user@example.com', 'password')).toEqual({
      success: true,
    });
  });
});

describe('signIn without a session', () => {
  it('reports a 2xx with neither a session nor a ticket', async () => {
    auth.signInEmailPassword.mockResolvedValueOnce({ body: {} });

    expect(await signIn('user@example.com', 'password')).toEqual({
      error: 'The server did not return a session. Try again.',
    });
  });

  // The backend refuses an unverified account with an error response, so it
  // reaches the catch, not the guard above.
  it('passes through the message for an unverified account', async () => {
    auth.signInEmailPassword.mockRejectedValueOnce(
      new FetchError(
        {
          status: 401,
          error: 'unverified-user',
          message: 'User is not verified.',
        },
        401,
        new Headers(),
      ),
    );

    expect(await signIn('user@example.com', 'password')).toEqual({
      error: 'Could not sign in: User is not verified.',
    });
  });
});

describe('verifyMfa', () => {
  it('asks for both parts before calling the backend', async () => {
    expect(await verifyMfa('mfaTotp:abc', '')).toEqual({
      error: 'Enter the code from your authenticator app.',
    });
    expect(auth.verifySignInMfaTotp).not.toHaveBeenCalled();
  });

  it('trades the ticket and code for a session', async () => {
    auth.verifySignInMfaTotp.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    expect(await verifyMfa('mfaTotp:abc', '123456')).toEqual({
      success: true,
    });
    expect(auth.verifySignInMfaTotp).toHaveBeenCalledWith({
      ticket: 'mfaTotp:abc',
      otp: '123456',
    });
  });

  it('treats a response without a session as a wrong code', async () => {
    auth.verifySignInMfaTotp.mockResolvedValueOnce({ body: {} });

    expect(await verifyMfa('mfaTotp:abc', '000000')).toEqual({
      error: 'That code did not work. Try again.',
    });
  });
});
