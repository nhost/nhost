import { FetchError } from '@nhost/nhost-js/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendCode, verifyCode } from '@/app/auth/otp/actions';

const signInOTPEmail = vi.hoisted(() => vi.fn());
const verifySignInOTPEmail = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({
    auth: { signInOTPEmail, verifySignInOTPEmail },
  }),
}));

describe('sendCode', () => {
  beforeEach(() => {
    signInOTPEmail.mockReset();
  });

  it('asks for an email before calling the backend', async () => {
    expect(await sendCode('')).toEqual({ error: 'Enter your email address.' });
    expect(signInOTPEmail).not.toHaveBeenCalled();
  });

  it('reports a backend error instead of throwing', async () => {
    signInOTPEmail.mockRejectedValueOnce(new Error('rate limited'));

    expect(await sendCode('user@example.com')).toEqual({
      error: 'Could not send the code: rate limited',
    });
  });
});

describe('verifyCode', () => {
  beforeEach(() => {
    verifySignInOTPEmail.mockReset();
  });

  it('asks for both fields before calling the backend', async () => {
    expect(await verifyCode('user@example.com', '')).toEqual({
      error: 'Enter your email address and the code.',
    });
    expect(verifySignInOTPEmail).not.toHaveBeenCalled();
  });

  // Guards a 2xx that comes back without a session.
  it('reports a 2xx that came back without a session', async () => {
    verifySignInOTPEmail.mockResolvedValueOnce({ body: {} });

    expect(await verifyCode('user@example.com', '000000')).toEqual({
      error: 'That code did not work. Try again.',
    });
  });

  // The backend answers a wrong code with an error response, so it reaches
  // the catch, not the guard above.
  it('passes through the message for a wrong code', async () => {
    verifySignInOTPEmail.mockRejectedValueOnce(
      new FetchError(
        {
          status: 400,
          error: 'invalid-otp',
          message: 'Invalid or expired OTP',
        },
        400,
        new Headers(),
      ),
    );

    expect(await verifyCode('user@example.com', '000000')).toEqual({
      error: 'Could not verify the code: Invalid or expired OTP',
    });
  });

  it('succeeds only when a session came back', async () => {
    verifySignInOTPEmail.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    expect(await verifyCode('user@example.com', '123456')).toEqual({
      success: true,
    });
  });
});
