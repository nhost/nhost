import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changePassword } from '@/app/profile/actions';
import { gqlRequest } from '@/lib/graphql';
import {
  clearPasswordResetGrant,
  createNhostClient,
  passwordResetGrantUserId,
} from '@/lib/nhost/server';

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: vi.fn(),
  passwordResetGrantUserId: vi.fn(),
  clearPasswordResetGrant: vi.fn(),
}));

vi.mock('@/lib/graphql', () => ({ gqlRequest: vi.fn() }));

const USER = 'user-id';

const signInEmailPassword = vi.fn();
const changeUserPassword = vi.fn();

const client = {
  getUserSession: () => ({ user: { id: USER, email: 'a@example.com' } }),
  auth: { signInEmailPassword, changeUserPassword },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createNhostClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createNhostClient>>,
  );
  // The account already has a password, so re-authentication is required
  // unless a grant says otherwise. This is the case the grant exists for.
  vi.mocked(gqlRequest).mockResolvedValue({
    user: { id: USER, hasPassword: true },
  } as never);
});

// The grant lets a password be set without the current one. What it is allowed
// to stand for is therefore the whole of the protection, and a grant that named
// no account stood for any of them at once.
describe('changePassword and the password-reset grant', () => {
  it('skips re-authentication for a grant issued to this account', async () => {
    vi.mocked(passwordResetGrantUserId).mockResolvedValue(USER);

    const result = await changePassword('a-new-password');

    expect(result).toEqual({ success: true });
    expect(changeUserPassword).toHaveBeenCalledWith({
      newPassword: 'a-new-password',
    });
    // Once, and only for the sign-in that follows the change - never to check
    // a current password, which is what being exempt means.
    expect(signInEmailPassword).toHaveBeenCalledOnce();
    expect(signInEmailPassword).toHaveBeenCalledWith({
      email: 'a@example.com',
      password: 'a-new-password',
    });
    // Spent, so one reset link sets one password.
    expect(clearPasswordResetGrant).toHaveBeenCalledOnce();
  });

  // The bypass this binding closes: redeeming a reset link for an account you
  // control mints a grant, and without the comparison that grant would be
  // spendable against whatever session the browser is carrying.
  it('refuses a grant issued to a different account', async () => {
    vi.mocked(passwordResetGrantUserId).mockResolvedValue('somebody-else');

    const result = await changePassword('a-new-password');

    expect(result).toEqual({
      error: 'Enter your current password to change it.',
    });
    expect(changeUserPassword).not.toHaveBeenCalled();
    expect(clearPasswordResetGrant).not.toHaveBeenCalled();
  });

  it('still takes the current password when there is no grant', async () => {
    vi.mocked(passwordResetGrantUserId).mockResolvedValue(null);

    expect(await changePassword('a-new-password')).toEqual({
      error: 'Enter your current password to change it.',
    });

    signInEmailPassword.mockResolvedValue({});

    expect(await changePassword('a-new-password', 'the-old-one')).toEqual({
      success: true,
    });
    // The old password is verified by signing in with it, then the new one.
    expect(signInEmailPassword).toHaveBeenNthCalledWith(1, {
      email: 'a@example.com',
      password: 'the-old-one',
    });
    expect(changeUserPassword).toHaveBeenCalledOnce();
  });
});
