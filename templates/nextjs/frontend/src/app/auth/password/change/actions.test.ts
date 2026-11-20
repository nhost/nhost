import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changePassword } from '@/app/auth/password/change/actions';

const auth = vi.hoisted(() => ({
  changeUserPassword: vi.fn(),
  signInEmailPassword: vi.fn(),
  verifySignInMfaTotp: vi.fn(),
}));

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({
    auth,
    getUserSession: () => ({
      user: { id: 'user-1', email: 'user@example.com' },
    }),
  }),
}));

beforeEach(() => {
  for (const fn of Object.values(auth)) {
    fn.mockReset();
  }
});

describe('changePassword', () => {
  // The change revoked this session with the rest, so the new password signs
  // this browser straight back in.
  it('signs this device back in with the new password', async () => {
    auth.changeUserPassword.mockResolvedValueOnce({ body: {} });
    auth.signInEmailPassword.mockResolvedValueOnce({
      body: { session: { accessToken: 'new' } },
    });

    expect(await changePassword('correct horse')).toEqual({
      success: true,
      signedIn: true,
    });
    expect(auth.signInEmailPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'correct horse',
    });
  });

  it('signs a two-factor account back in with the code it was given', async () => {
    auth.changeUserPassword.mockResolvedValueOnce({ body: {} });
    auth.signInEmailPassword.mockResolvedValueOnce({
      body: { mfa: { ticket: 'mfaTotp:abc' } },
    });
    auth.verifySignInMfaTotp.mockResolvedValueOnce({
      body: { session: { accessToken: 'new' } },
    });

    expect(await changePassword('correct horse', '123456')).toEqual({
      success: true,
      signedIn: true,
    });
    expect(auth.verifySignInMfaTotp).toHaveBeenCalledWith({
      ticket: 'mfaTotp:abc',
      otp: '123456',
    });
  });

  // The form checks too, but the action is callable without it.
  it('refuses a password auth would refuse, without asking it', async () => {
    for (const password of ['short', 'a'.repeat(51), 'é'.repeat(37)]) {
      expect((await changePassword(password)).error).toMatch(/^Use /);
    }
    expect(auth.changeUserPassword).not.toHaveBeenCalled();
  });

  it('puts a breached password in words', async () => {
    auth.changeUserPassword.mockRejectedValueOnce(
      Object.assign(new Error('Password is in HIBP database'), {
        body: { error: 'password-in-hibp-database' },
      }),
    );

    expect(await changePassword('correct horse')).toEqual({
      error:
        'Could not change the password: This password has appeared in a data breach. Choose another.',
    });
  });
});
