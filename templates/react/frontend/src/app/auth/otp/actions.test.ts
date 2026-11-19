// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NO_TRIES_LEFT,
  sendCode,
  verifyCode,
  WRONG_CODE,
} from '@/app/auth/otp/actions';
import { appOrigin } from '@/lib/nhost/env';

const signInOTPEmail = vi.hoisted(() => vi.fn());
const verifySignInOTPEmail = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/client', () => ({
  nhost: { auth: { signInOTPEmail, verifySignInOTPEmail } },
}));

describe('sendCode', () => {
  beforeEach(() => {
    signInOTPEmail.mockReset();
  });

  it('sends the code page for that address as redirectTo', async () => {
    signInOTPEmail.mockResolvedValueOnce({});

    await sendCode('a+b@example.com', '/protected');

    expect(signInOTPEmail).toHaveBeenCalledWith({
      email: 'a+b@example.com',
      options: {
        redirectTo: `${appOrigin()}/auth/otp?next=%2Fprotected&intent=sign-in&email=a%2Bb%40example.com`,
      },
    });
  });
});

describe('verifyCode', () => {
  beforeEach(() => {
    verifySignInOTPEmail.mockReset();
  });

  it('succeeds only when a session came back', async () => {
    verifySignInOTPEmail.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    expect(await verifyCode('user@example.com', '123456')).toEqual({
      success: true,
    });
  });

  it('sends a pasted code without its spaces', async () => {
    verifySignInOTPEmail.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    await verifyCode('user@example.com', ' 123 456\n');

    expect(verifySignInOTPEmail).toHaveBeenCalledWith({
      email: 'user@example.com',
      otp: '123456',
    });
  });

  // A code from an earlier email is wrong too, which auth can't tell apart.
  it('points a wrong code at the most recent email', async () => {
    verifySignInOTPEmail.mockRejectedValueOnce(
      Object.assign(new Error('Invalid or expired OTP'), {
        status: 400,
        body: { error: 'invalid-otp' },
      }),
    );

    expect(await verifyCode('user@example.com', '123456')).toEqual({
      error: WRONG_CODE,
    });
  });

  it('asks for a new code once auth has burned this one', async () => {
    verifySignInOTPEmail.mockRejectedValueOnce(
      Object.assign(new Error('Too many attempts'), {
        status: 400,
        body: { error: 'otp-too-many-attempts' },
      }),
    );

    expect(await verifyCode('user@example.com', '123456')).toEqual({
      error: NO_TRIES_LEFT,
    });
  });
});
