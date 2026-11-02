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
});

describe('verifyMfa', () => {
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
});
