import { beforeEach, describe, expect, it, vi } from 'vitest';
import { inRequest } from '#lib/testing/appServer.ts';
import { changePassword } from './actions.remote.ts';

const auth = vi.hoisted(() => ({
  baseURL: 'https://auth.test/v1',
  changeUserPassword: vi.fn(),
  signInEmailPassword: vi.fn(),
  verifySignInMfaTotp: vi.fn(),
}));
const bareSignOut = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());

vi.stubGlobal('fetch', fetchMock);

vi.mock('$app/server', () => import('#lib/testing/appServer.ts'));
vi.mock('#lib/nhost/server.ts', () => ({
  createNhostClient: () => ({
    auth,
    getUserSession: () => ({
      accessToken: 'current-access-token',
      user: { id: 'user-1', email: 'user@example.com' },
    }),
  }),
}));
vi.mock('@nhost/nhost-js/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nhost/nhost-js/auth')>()),
  createAPIClient: () => ({ signOut: bareSignOut }),
}));

const WRONG_CODE =
  'That code did not work, so the password was not changed. Try again.';

beforeEach(() => {
  inRequest({ clientAddress: '203.0.113.7' });
  for (const fn of [
    auth.changeUserPassword,
    auth.signInEmailPassword,
    auth.verifySignInMfaTotp,
    bareSignOut,
    fetchMock,
  ]) {
    fn.mockReset();
  }
});

const answer = (status: number, body?: unknown): Response =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const checked = { accessToken: 'checked', refreshToken: 'checked-refresh' };

const breached = () =>
  Object.assign(new Error('Password is in HIBP database'), {
    body: { error: 'password-in-hibp-database' },
  });

describe('changePassword', () => {
  // The change revoked this session with the rest, so the new password signs
  // this browser straight back in.
  it('signs this device back in with the new password', async () => {
    auth.changeUserPassword.mockResolvedValueOnce({ body: {} });
    auth.signInEmailPassword.mockResolvedValueOnce({
      body: { session: { accessToken: 'new' } },
    });

    expect(await changePassword({ newPassword: 'correct horse' })).toEqual({
      success: true,
      signedIn: true,
    });
    expect(auth.signInEmailPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'correct horse',
    });
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

    expect(
      await changePassword({ newPassword: 'correct horse', otp: '123456' }),
    ).toEqual({ success: true, signedIn: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.test/v1/elevate/totp',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ otp: '123456' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer current-access-token',
          'X-Forwarded-For': '203.0.113.7',
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

    expect(
      await changePassword({ newPassword: 'correct horse', otp: '000000' }),
    ).toEqual({ error: WRONG_CODE });
    expect(auth.changeUserPassword).not.toHaveBeenCalled();
    expect(bareSignOut).not.toHaveBeenCalled();
  });

  // An auth without `/elevate/totp`, or one that is rate limiting, must not be
  // read as a right code.
  it('leaves the password alone when the code cannot be checked', async () => {
    fetchMock.mockResolvedValueOnce(answer(404));
    expect(
      (await changePassword({ newPassword: 'correct horse', otp: '123456' }))
        .error,
    ).toMatch(/^Could not check the code: /);

    // `/elevate/` counts against the brute-force limit.
    fetchMock.mockResolvedValueOnce(answer(429));
    expect(
      await changePassword({ newPassword: 'correct horse', otp: '123456' }),
    ).toEqual({
      error:
        'Could not check the code: Too many attempts. Try again in 5 minutes.',
    });

    expect(auth.changeUserPassword).not.toHaveBeenCalled();
  });

  // A successful change would have revoked it with every other session. On a
  // bare client, since the main one would clear this browser's cookie.
  it('signs out the checked session when the change fails', async () => {
    fetchMock.mockResolvedValueOnce(answer(200, { session: checked }));
    auth.changeUserPassword.mockRejectedValueOnce(breached());
    bareSignOut.mockResolvedValueOnce({ body: 'OK' });

    expect(
      await changePassword({ newPassword: 'correct horse', otp: '123456' }),
    ).toEqual({
      error:
        'Could not change the password: This password has appeared in a data breach. Choose another.',
    });
    expect(bareSignOut).toHaveBeenCalledWith({
      refreshToken: 'checked-refresh',
    });
  });

  // The old session is revoked either way; the form shows the changed card.
  it('reports the change done but this device signed out when signing back in fails', async () => {
    auth.changeUserPassword.mockResolvedValueOnce({ body: {} });
    auth.signInEmailPassword.mockRejectedValueOnce(new Error('rate limited'));
    vi.spyOn(console, 'error').mockImplementationOnce(() => undefined);

    expect(await changePassword({ newPassword: 'correct horse' })).toEqual({
      success: true,
      signedIn: false,
    });
  });

  // The form checks too, but the command is callable without it.
  it('refuses a password auth would refuse, without asking it', async () => {
    for (const password of ['short', 'a'.repeat(51), 'é'.repeat(37)]) {
      expect((await changePassword({ newPassword: password })).error).toMatch(
        /^Use /,
      );
    }
    expect(auth.changeUserPassword).not.toHaveBeenCalled();
  });

  it('puts a breached password in words', async () => {
    auth.changeUserPassword.mockRejectedValueOnce(breached());

    expect(await changePassword({ newPassword: 'correct horse' })).toEqual({
      error:
        'Could not change the password: This password has appeared in a data breach. Choose another.',
    });
  });
});
