import {
  NO_TRIES_LEFT,
  sendCode,
  verifyCode,
  WRONG_CODE,
} from '@/screens/auth/otp/actions';

const mockSend = jest.fn();
const mockVerify = jest.fn();

jest.mock('@/lib/nhost/client', () => ({
  nhost: {
    auth: {
      signInOTPEmail: (...args: unknown[]) => mockSend(...args),
      verifySignInOTPEmail: (...args: unknown[]) => mockVerify(...args),
    },
  },
}));

beforeEach(() => {
  mockSend.mockReset();
  mockVerify.mockReset();
});

describe('sendCode', () => {
  // Nothing comes back through a link, so there is no redirect to protect.
  it('asks for a code without a redirect', async () => {
    mockSend.mockResolvedValueOnce({});

    expect(await sendCode('a+b@example.com')).toEqual({ success: true });

    expect(mockSend).toHaveBeenCalledWith({ email: 'a+b@example.com' });
  });

  it('sends the address without surrounding spaces', async () => {
    mockSend.mockResolvedValueOnce({});

    await sendCode(' user@example.com ');

    expect(mockSend).toHaveBeenCalledWith({ email: 'user@example.com' });
  });

  it('names the email limit when auth refuses for the rate', async () => {
    mockSend.mockRejectedValueOnce({ status: 429, message: '' });

    expect(await sendCode('user@example.com')).toEqual({
      error:
        'Could not send the code: Too many attempts. Try again in an hour.',
    });
  });
});

describe('verifyCode', () => {
  it('succeeds only when a session came back', async () => {
    mockVerify.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    expect(await verifyCode('user@example.com', '123456')).toEqual({
      success: true,
    });

    mockVerify.mockResolvedValueOnce({ body: { session: null } });

    expect(await verifyCode('user@example.com', '123456')).toEqual({
      error: 'That code did not work. Try again.',
    });
  });

  it('sends a pasted code without its spaces', async () => {
    mockVerify.mockResolvedValueOnce({
      body: { session: { accessToken: 'token' } },
    });

    await verifyCode('user@example.com', ' 123 456\n');

    expect(mockVerify).toHaveBeenCalledWith({
      email: 'user@example.com',
      otp: '123456',
    });
  });

  // A code from an earlier email is wrong too, which auth can't tell apart.
  it('points a wrong code at the most recent email', async () => {
    mockVerify.mockRejectedValueOnce(
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
    mockVerify.mockRejectedValueOnce(
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
