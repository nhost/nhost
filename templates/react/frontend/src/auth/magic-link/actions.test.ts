import type { NhostClient } from '@nhost/nhost-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMagicLink } from '@/auth/magic-link/actions';
import { appOrigin } from '@/lib/nhost/env';

const signInPasswordlessEmail = vi.fn();

const nhost = {
  auth: { signInPasswordlessEmail },
} as unknown as NhostClient;

const sentRedirectTo = (): string =>
  signInPasswordlessEmail.mock.calls[0][0].options.redirectTo;

describe('sendMagicLink', () => {
  beforeEach(() => {
    signInPasswordlessEmail.mockReset();
    signInPasswordlessEmail.mockResolvedValue({ body: {} });
  });

  it('sends the link back to the requested path', async () => {
    await sendMagicLink(nhost, 'user@example.com', '/protected');

    expect(sentRedirectTo()).toBe(`${appOrigin()}/protected`);
  });

  // The link in the email is built from `next`, so a crafted one would be
  // emailed to the visitor pointing away from this app.
  it('keeps the link on this origin', async () => {
    for (const hostile of [
      '//evil.example',
      '/\\evil.example',
      'evil.example',
    ]) {
      signInPasswordlessEmail.mockClear();

      await sendMagicLink(nhost, 'user@example.com', hostile);

      expect(sentRedirectTo()).toBe(`${appOrigin()}/`);
    }
  });
});
