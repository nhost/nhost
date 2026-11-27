import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appOrigin } from '#lib/nhost/env.server.ts';
import { DEFAULT_DESTINATION } from '#routes/signin/destination.ts';
import { sendMagicLink } from './actions.remote.ts';

const signInPasswordlessEmail = vi.hoisted(() => vi.fn());

vi.mock('$app/server', () => import('#lib/testing/appServer.ts'));
vi.mock('#lib/nhost/server.ts', () => ({
  createNhostClient: () => ({ auth: { signInPasswordlessEmail } }),
}));

const sentRedirectTo = (): string =>
  signInPasswordlessEmail.mock.calls[0][0].options.redirectTo;

describe('sendMagicLink', () => {
  beforeEach(() => {
    signInPasswordlessEmail.mockReset();
  });

  // The command is callable without the page, so `next` here is whatever the
  // caller sent. Appended to the origin, each of these changes the host.
  it('keeps the link on this origin when called directly', async () => {
    for (const hostile of ['-attacker.example/', '@evil.example/', '.evil']) {
      signInPasswordlessEmail.mockReset();

      await sendMagicLink({ email: 'user@example.com', next: hostile });

      expect(sentRedirectTo()).toBe(`${appOrigin()}${DEFAULT_DESTINATION}`);
    }
  });
});
