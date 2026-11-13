import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendCode, verifyCode } from '@/app/auth/otp/actions';
import { appOrigin } from '@/lib/nhost/env';

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
});
