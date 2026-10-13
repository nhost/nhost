import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changePassword } from '@/app/account/actions';

const client = vi.hoisted(() => ({
  session: null as object | null,
  auth: { changeUserPassword: vi.fn() },
}));

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({
    getUserSession: () => client.session,
    auth: client.auth,
  }),
}));

describe('changePassword', () => {
  beforeEach(() => {
    client.session = { accessToken: 'token' };
    client.auth.changeUserPassword.mockReset();
  });

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
