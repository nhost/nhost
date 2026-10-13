import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMagicLink } from '@/app/auth/magic-link/actions';
import { appOrigin } from '@/lib/nhost/env';

const signInPasswordlessEmail = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({ auth: { signInPasswordlessEmail } }),
}));

const sentRedirectTo = (): string =>
  signInPasswordlessEmail.mock.calls[0][0].options.redirectTo;

describe('sendMagicLink', () => {
  beforeEach(() => {
    signInPasswordlessEmail.mockReset();
  });

  it('sends the link back to the requested path', async () => {
    await sendMagicLink('user@example.com', '/protected');

    expect(sentRedirectTo()).toBe(`${appOrigin()}/protected`);
  });

  // The action is callable without the page, so `next` here is whatever the
  // caller sent. Appended to the origin, each of these changes the host.
  it('keeps the link on this origin when called directly', async () => {
    for (const hostile of ['-attacker.example/', '@evil.example/', '.evil']) {
      signInPasswordlessEmail.mockReset();

      await sendMagicLink('user@example.com', hostile);

      expect(sentRedirectTo()).toBe(`${appOrigin()}/`);
    }
  });
});
