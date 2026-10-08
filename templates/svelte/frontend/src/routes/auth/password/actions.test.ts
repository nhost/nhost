import type { NhostClient } from '@nhost/nhost-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appOrigin } from '$lib/nhost/env';
import { signUp } from './actions';

const signUpEmailPassword = vi.fn();

// Only the one call these tests exercise; the rest of the client is never
// reached, so standing up more of it would only hide what this depends on.
const nhost = { auth: { signUpEmailPassword } } as unknown as NhostClient;

const sentRedirectTo = (): string =>
  signUpEmailPassword.mock.calls[0][0].options.redirectTo;

describe('signUp', () => {
  beforeEach(() => {
    signUpEmailPassword.mockReset();
    signUpEmailPassword.mockResolvedValue({ body: { session: null } });
  });

  it('sends the verification link back to the requested path', async () => {
    await signUp(nhost, 'user@example.com', 'password', '/protected');

    expect(sentRedirectTo()).toBe(`${appOrigin()}/protected`);
  });

  // `next` arrives on the URL, so it is whatever the visitor followed a link
  // with. Appended to the origin, each of these changes the host the
  // verification email would point at.
  it('keeps the verification link on this origin', async () => {
    for (const hostile of ['-attacker.example/', '@evil.example/', '.evil']) {
      signUpEmailPassword.mockClear();

      await signUp(nhost, 'user@example.com', 'password', hostile);

      expect(sentRedirectTo()).toBe(`${appOrigin()}/`);
    }
  });
});
