import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setNewPassword, signUp } from '@/app/auth/password/actions';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { appOrigin } from '@/lib/nhost/env';

const signUpEmailPassword = vi.hoisted(() => vi.fn());
const changeUserPassword = vi.hoisted(() => vi.fn());
const endPasswordReset = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({
    auth: { signUpEmailPassword, changeUserPassword },
    getUserSession: () => ({ user: { id: 'user-id' } }),
  }),
  endPasswordReset,
}));

const sentRedirectTo = (): string =>
  signUpEmailPassword.mock.calls[0][0].options.redirectTo;

describe('signUp', () => {
  beforeEach(() => {
    signUpEmailPassword.mockReset();
    signUpEmailPassword.mockResolvedValue({ body: { session: null } });
  });

  // The action is callable without the page, so `next` here is whatever the
  // caller sent. Appended to the origin, each of these changes the host.
  it('keeps the verification link on this origin when called directly', async () => {
    for (const hostile of ['-attacker.example/', '@evil.example/', '.evil']) {
      signUpEmailPassword.mockClear();

      await signUp('user@example.com', 'password', hostile);

      expect(sentRedirectTo()).toBe(`${appOrigin()}${DEFAULT_DESTINATION}`);
    }
  });
});

describe('setNewPassword', () => {
  beforeEach(() => {
    changeUserPassword.mockReset();
    endPasswordReset.mockReset();
  });

  // Saving the password is what lets a reset link's session leave the page.
  it('ends the reset once the password is changed', async () => {
    changeUserPassword.mockResolvedValueOnce({});

    expect(await setNewPassword('a new password')).toEqual({ success: true });
    expect(endPasswordReset).toHaveBeenCalledTimes(1);
  });
});
