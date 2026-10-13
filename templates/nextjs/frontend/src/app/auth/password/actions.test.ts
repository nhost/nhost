import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signUp } from '@/app/auth/password/actions';
import { appOrigin } from '@/lib/nhost/env';

const signUpEmailPassword = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({ auth: { signUpEmailPassword } }),
}));

const sentRedirectTo = (): string =>
  signUpEmailPassword.mock.calls[0][0].options.redirectTo;

describe('signUp', () => {
  beforeEach(() => {
    signUpEmailPassword.mockReset();
    signUpEmailPassword.mockResolvedValue({ body: { session: null } });
  });

  it('sends the verification link back to the requested path', async () => {
    await signUp('user@example.com', 'password', '/protected');

    expect(sentRedirectTo()).toBe(`${appOrigin()}/protected`);
  });

  // The action is callable without the page, so `next` here is whatever the
  // caller sent. Appended to the origin, each of these changes the host.
  it('keeps the verification link on this origin when called directly', async () => {
    for (const hostile of ['-attacker.example/', '@evil.example/', '.evil']) {
      signUpEmailPassword.mockClear();

      await signUp('user@example.com', 'password', hostile);

      expect(sentRedirectTo()).toBe(`${appOrigin()}/`);
    }
  });
});
