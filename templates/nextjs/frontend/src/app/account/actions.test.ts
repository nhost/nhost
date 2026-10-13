import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changeEmail,
  changePassword,
  resendVerification,
} from '@/app/account/actions';
import { appOrigin } from '@/lib/nhost/env';

const client = vi.hoisted(() => ({
  session: null as object | null,
  verifiedUser: null as { email?: string } | null,
  auth: {
    changeUserPassword: vi.fn(),
    changeUserEmail: vi.fn(),
    sendVerificationEmail: vi.fn(),
  },
}));

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({
    getUserSession: () => client.session,
    auth: client.auth,
  }),
  getVerifiedUser: async () => client.verifiedUser,
}));

beforeEach(() => {
  client.session = { accessToken: 'token' };
  client.verifiedUser = { email: 'user@example.com' };
  for (const fn of Object.values(client.auth)) {
    fn.mockReset();
  }
});

describe('changePassword', () => {
  it('asks for a password before calling the backend', async () => {
    expect(await changePassword('')).toEqual({
      error: 'A new password is required.',
    });
    expect(client.auth.changeUserPassword).not.toHaveBeenCalled();
  });

  it('refuses without a session rather than calling the backend', async () => {
    client.session = null;

    expect(await changePassword('correct horse')).toEqual({
      error: 'You are signed out. Sign in and try again.',
    });
    expect(client.auth.changeUserPassword).not.toHaveBeenCalled();
  });

  // Only the new password goes to the backend: the endpoint has no field for
  // the current one.
  it('sends the new password and nothing else', async () => {
    client.auth.changeUserPassword.mockResolvedValueOnce({ body: {} });

    expect(await changePassword('correct horse')).toEqual({ success: true });
    expect(client.auth.changeUserPassword).toHaveBeenCalledWith({
      newPassword: 'correct horse',
    });
  });

  it('reports a backend error instead of throwing', async () => {
    client.auth.changeUserPassword.mockRejectedValueOnce(
      new Error('password too short'),
    );

    expect(await changePassword('short')).toEqual({
      error: 'Could not change the password: password too short',
    });
  });
});

describe('changeEmail', () => {
  it('asks for an address before calling the backend', async () => {
    expect(await changeEmail('')).toEqual({
      error: 'A new email address is required.',
    });
    expect(client.auth.changeUserEmail).not.toHaveBeenCalled();
  });

  it('refuses without a session', async () => {
    client.session = null;

    expect(await changeEmail('new@example.com')).toEqual({
      error: 'You are signed out. Sign in and try again.',
    });
    expect(client.auth.changeUserEmail).not.toHaveBeenCalled();
  });

  // The link lands on the account page, on this origin, whatever the caller
  // sent: the redirect is not taken from the arguments at all.
  it('sends the confirmation link back to the account page', async () => {
    client.auth.changeUserEmail.mockResolvedValueOnce({ body: {} });

    expect(await changeEmail('new@example.com')).toEqual({ success: true });
    expect(client.auth.changeUserEmail).toHaveBeenCalledWith({
      newEmail: 'new@example.com',
      options: { redirectTo: `${appOrigin()}/account` },
    });
  });
});

describe('resendVerification', () => {
  it('sends to the address the auth service vouches for', async () => {
    client.auth.sendVerificationEmail.mockResolvedValueOnce({ body: {} });

    expect(await resendVerification()).toEqual({ success: true });
    expect(client.auth.sendVerificationEmail).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: { redirectTo: `${appOrigin()}/account` },
    });
  });

  it('refuses when the auth service does not vouch for anyone', async () => {
    client.verifiedUser = null;

    expect(await resendVerification()).toEqual({
      error: 'You are signed out. Sign in and try again.',
    });
    expect(client.auth.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
