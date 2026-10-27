import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMagicLink } from '@/app/auth/magic-link/actions';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
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

  // The action is callable without the page, so `next` here is whatever the
  // caller sent. Appended to the origin, each of these changes the host.
  it('keeps the link on this origin when called directly', async () => {
    for (const hostile of ['-attacker.example/', '@evil.example/', '.evil']) {
      signInPasswordlessEmail.mockReset();

      await sendMagicLink('user@example.com', hostile);

      expect(sentRedirectTo()).toBe(`${appOrigin()}${DEFAULT_DESTINATION}`);
    }
  });
});
