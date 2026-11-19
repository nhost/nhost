import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changePassword, WRONG_CODE } from '@/app/auth/password/change/actions';

const auth = vi.hoisted(() => ({
  changeUserPassword: vi.fn(),
  signInEmailPassword: vi.fn(),
  verifySignInMfaTotp: vi.fn(),
  signOut: vi.fn(),
}));
const set = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());

vi.stubGlobal('fetch', fetchMock);

vi.mock('@/lib/nhost/client', () => ({
  bareAuth: () => ({ ...auth, baseURL: 'https://auth.test/v1' }),
  nhost: {
    refreshSession: async () => null,
    getUserSession: () => ({
      accessToken: 'current-access-token',
      user: { id: 'user-1', email: 'user@example.com' },
    }),
    sessionStorage: { set },
  },
}));

beforeEach(() => {
  for (const fn of [...Object.values(auth), set, fetchMock]) {
    fn.mockReset();
  }
});

const answer = (status: number, body?: unknown): Response =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const checked = { accessToken: 'checked', refreshToken: 'checked-refresh' };

describe('changePassword', () => {
  // The change revoked this session with the rest, so the new password signs
  // this browser straight back in.
  it('signs this device back in with the new password', async () => {
    const session = { accessToken: 'new' };
    auth.changeUserPassword.mockResolvedValueOnce({ body: {} });
    auth.signInEmailPassword.mockResolvedValueOnce({ body: { session } });

    expect(await changePassword('correct horse')).toEqual({
      success: true,
      signedIn: true,
    });
    expect(auth.changeUserPassword).toHaveBeenCalledWith(
      { newPassword: 'correct horse' },
      { headers: { Authorization: 'Bearer current-access-token' } },
    );
    expect(auth.signInEmailPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'correct horse',
    });
    expect(set).toHaveBeenCalledWith(session);
  });

  it('checks the code, then changes and signs a two-factor account back in with it', async () => {
    fetchMock.mockResolvedValueOnce(answer(200, { session: checked }));
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
    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.test/v1/elevate/totp',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ otp: '123456' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer current-access-token',
        }),
      }),
    );
    expect(auth.changeUserPassword).toHaveBeenCalledWith(
      { newPassword: 'correct horse' },
      { headers: { Authorization: 'Bearer checked' } },
    );
    expect(auth.verifySignInMfaTotp).toHaveBeenCalledWith({
      ticket: 'mfaTotp:abc',
      otp: '123456',
    });
  });

  // The change takes no code, so without the check a wrong one would still
  // change the password and sign this browser out.
  it('leaves the password alone when the code is wrong', async () => {
    fetchMock.mockResolvedValueOnce(
      answer(401, { error: 'invalid-totp', status: 401 }),
    );

    expect(await changePassword('correct horse', '000000')).toEqual({
      error: WRONG_CODE,
    });
    expect(auth.changeUserPassword).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  // An auth without `/elevate/totp`, or one that is rate limiting, must not be
  // read as a right code.
  it('leaves the password alone when the code cannot be checked', async () => {
    for (const status of [404, 429]) {
      fetchMock.mockResolvedValueOnce(answer(status));

      expect((await changePassword('correct horse', '123456')).error).toMatch(
        /^Could not check the code: /,
      );
    }
    expect(auth.changeUserPassword).not.toHaveBeenCalled();
  });

  // A successful change would have revoked it with every other session.
  it('signs out the checked session when the change fails', async () => {
    fetchMock.mockResolvedValueOnce(answer(200, { session: checked }));
    auth.changeUserPassword.mockRejectedValueOnce(
      Object.assign(new Error('Password is in HIBP database'), {
        body: { error: 'password-in-hibp-database' },
      }),
    );
    auth.signOut.mockResolvedValueOnce({ body: 'OK' });

    expect(await changePassword('correct horse', '123456')).toEqual({
      error:
        'Could not change the password: This password has appeared in a data breach. Choose another.',
    });
    expect(auth.signOut).toHaveBeenCalledWith({
      refreshToken: 'checked-refresh',
    });
  });

  // The old session is revoked either way; the form clears it.
  it('reports the change done but this device signed out when signing back in fails', async () => {
    auth.changeUserPassword.mockResolvedValueOnce({ body: {} });
    auth.signInEmailPassword.mockRejectedValueOnce(new Error('rate limited'));
    vi.spyOn(console, 'error').mockImplementationOnce(() => undefined);

    expect(await changePassword('correct horse')).toEqual({
      success: true,
      signedIn: false,
    });
    expect(set).not.toHaveBeenCalled();
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
