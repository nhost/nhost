import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changeEmail } from '@/app/profile/actions';
import { gqlRequest } from '@/lib/graphql';
import { createNhostClient } from '@/lib/nhost/server';

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: vi.fn(),
}));

vi.mock('@/lib/graphql', () => ({ gqlRequest: vi.fn() }));

const USER = 'user-id';

const signInEmailPassword = vi.fn();
const changeUserEmail = vi.fn();
const verifySignInOTPEmail = vi.fn();

const client = {
  getUserSession: () => ({ user: { id: USER, email: 'a@example.com' } }),
  auth: { signInEmailPassword, changeUserEmail, verifySignInOTPEmail },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createNhostClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createNhostClient>>,
  );
});

// `changeUserEmail` notifies only the new address, never the old one, so a
// session alone would let a stolen session redirect the account's login
// identity to a mailbox the attacker controls without ever knowing the
// current password - the same takeover `changePassword` guards against.
describe('changeEmail re-authentication', () => {
  it('refuses without the current password when the account has one', async () => {
    vi.mocked(gqlRequest).mockResolvedValue({
      user: { id: USER, hasPassword: true },
    } as never);

    const result = await changeEmail('new@example.com');

    expect(result).toEqual({
      error: 'Enter your current password to change it.',
    });
    expect(changeUserEmail).not.toHaveBeenCalled();
  });

  it('refuses a wrong current password', async () => {
    vi.mocked(gqlRequest).mockResolvedValue({
      user: { id: USER, hasPassword: true },
    } as never);
    signInEmailPassword.mockRejectedValue(new Error('invalid'));

    const result = await changeEmail('new@example.com', 'wrong-password');

    expect(result).toEqual({ error: 'That is not your current password.' });
    expect(changeUserEmail).not.toHaveBeenCalled();
  });

  it('requests the change once the current password checks out', async () => {
    vi.mocked(gqlRequest).mockResolvedValue({
      user: { id: USER, hasPassword: true },
    } as never);
    signInEmailPassword.mockResolvedValue({});
    changeUserEmail.mockResolvedValue({});

    const result = await changeEmail('new@example.com', 'the-current-one');

    expect(result).toEqual({ success: true });
    expect(signInEmailPassword).toHaveBeenCalledOnce();
    expect(signInEmailPassword).toHaveBeenCalledWith({
      email: 'a@example.com',
      password: 'the-current-one',
    });
    expect(changeUserEmail).toHaveBeenCalledOnce();
  });

  it('refuses without an emailed code when the account has no password', async () => {
    vi.mocked(gqlRequest).mockResolvedValue({
      user: { id: USER, hasPassword: false },
    } as never);

    const result = await changeEmail('new@example.com');

    expect(result).toEqual({
      error: 'Enter the code we emailed you to confirm this change.',
    });
    expect(changeUserEmail).not.toHaveBeenCalled();
  });

  it('refuses an invalid emailed code on an account with no password', async () => {
    vi.mocked(gqlRequest).mockResolvedValue({
      user: { id: USER, hasPassword: false },
    } as never);
    verifySignInOTPEmail.mockRejectedValue(new Error('invalid'));

    const result = await changeEmail('new@example.com', 'wrong-code');

    expect(result).toEqual({ error: 'That code is not valid.' });
    expect(changeUserEmail).not.toHaveBeenCalled();
  });

  it('requests the change once the emailed code checks out on an account with no password', async () => {
    vi.mocked(gqlRequest).mockResolvedValue({
      user: { id: USER, hasPassword: false },
    } as never);
    verifySignInOTPEmail.mockResolvedValue({});
    changeUserEmail.mockResolvedValue({});

    const result = await changeEmail('new@example.com', '123456');

    expect(result).toEqual({ success: true });
    expect(verifySignInOTPEmail).toHaveBeenCalledWith({
      email: 'a@example.com',
      otp: '123456',
    });
    expect(changeUserEmail).toHaveBeenCalledOnce();
  });
});
