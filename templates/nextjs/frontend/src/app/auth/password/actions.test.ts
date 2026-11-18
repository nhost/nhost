import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setNewPassword, signIn, signUp } from '@/app/auth/password/actions';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { appOrigin } from '@/lib/nhost/env';

const signInEmailPassword = vi.hoisted(() => vi.fn());
const signUpEmailPassword = vi.hoisted(() => vi.fn());
const changeUserPassword = vi.hoisted(() => vi.fn());
const endPasswordReset = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({
    auth: { signInEmailPassword, signUpEmailPassword, changeUserPassword },
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

      await signUp('user@example.com', 'correct horse', hostile);

      expect(sentRedirectTo()).toBe(`${appOrigin()}${DEFAULT_DESTINATION}`);
    }
  });

  // Auth would answer with a bare schema error, or a 500 once bcrypt refuses
  // more than 72 bytes.
  it('refuses a password auth would refuse, without asking it', async () => {
    for (const password of ['short', 'a'.repeat(51), 'é'.repeat(37)]) {
      expect((await signUp('user@example.com', password, '/')).error).toMatch(
        /^Use /,
      );
    }
    expect(signUpEmailPassword).not.toHaveBeenCalled();
  });
});

describe('signIn', () => {
  beforeEach(() => {
    signInEmailPassword.mockReset();
  });

  it('answers a password no account can have as a wrong one', async () => {
    for (const password of ['ab', 'a'.repeat(51)]) {
      expect(await signIn('user@example.com', password)).toEqual({
        error: 'Could not sign in: Incorrect email or password',
      });
    }
    expect(signInEmailPassword).not.toHaveBeenCalled();
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

  it('keeps the reset going when the password would be refused', async () => {
    expect((await setNewPassword('é'.repeat(37))).error).toMatch(/^Use /);
    expect(changeUserPassword).not.toHaveBeenCalled();
    expect(endPasswordReset).not.toHaveBeenCalled();
  });
});
