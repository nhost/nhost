import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appOrigin } from '#lib/nhost/env.server.ts';
import { sendCode, verifyCode } from './actions.remote.ts';

const signInOTPEmail = vi.hoisted(() => vi.fn());
const verifySignInOTPEmail = vi.hoisted(() => vi.fn());

vi.mock('$app/server', () => import('#lib/testing/appServer.ts'));
vi.mock('#lib/nhost/server.ts', () => ({
  createNhostClient: () => ({
    auth: { signInOTPEmail, verifySignInOTPEmail },
  }),
}));

describe('sendCode', () => {
  beforeEach(() => {
    signInOTPEmail.mockReset();
  });

  it('sends the code page for that address as redirectTo', async () => {
    signInOTPEmail.mockResolvedValueOnce({});

    await sendCode({ email: 'a+b@example.com', next: '/protected' });

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

  const rejected = (message: string, error: string) =>
    Object.assign(new Error(message), { status: 400, body: { error } });

  it('succeeds only when a session came back', async () => {
    verifySignInOTPEmail.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    expect(
      await verifyCode({ email: 'user@example.com', otp: '123456' }),
    ).toEqual({ success: true });
  });

  it('sends a pasted code without its spaces', async () => {
    verifySignInOTPEmail.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    await verifyCode({ email: 'user@example.com', otp: ' 123 456\n' });

    expect(verifySignInOTPEmail).toHaveBeenCalledWith({
      email: 'user@example.com',
      otp: '123456',
    });
  });

  // A code from an earlier email is wrong too, which auth can't tell apart.
  it('points a wrong code at the most recent email', async () => {
    verifySignInOTPEmail.mockRejectedValueOnce(
      rejected('Invalid or expired OTP', 'invalid-otp'),
    );

    expect(
      await verifyCode({ email: 'user@example.com', otp: '123456' }),
    ).toEqual({
      error:
        'That code did not work. Use the code from the most recent email, or send a new one.',
    });
  });

  it('asks for a new code once auth has burned this one', async () => {
    verifySignInOTPEmail.mockRejectedValueOnce(
      rejected('Too many attempts', 'otp-too-many-attempts'),
    );

    expect(
      await verifyCode({ email: 'user@example.com', otp: '123456' }),
    ).toEqual({
      error:
        'Too many wrong codes, so that code no longer works. Send a new one.',
    });
  });
});
