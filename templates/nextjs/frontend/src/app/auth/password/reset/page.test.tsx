import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ResetPassword from '@/app/auth/password/reset/page';

const getUserSession = vi.hoisted(() => vi.fn<() => unknown>(() => null));

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({ getUserSession }),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({}) }));

describe('password reset page', () => {
  // Only the sign-in mode offers to send a reset link, and the form opens on
  // sign up without an intent.
  it('asks for a new link on the form that can send one', async () => {
    const html = renderToStaticMarkup(await ResetPassword());

    expect(html).toContain('This link no longer works');
    expect(html).toContain('href="/auth/password?intent=sign-in"');
  });

  // The proxy keeps an existing session rather than redeem the link, so the
  // page cannot say the link is what signed the visitor in.
  it('names the signed-in account without crediting the link', async () => {
    getUserSession.mockReturnValueOnce({ user: { email: 'a@example.com' } });

    const html = renderToStaticMarkup(await ResetPassword());

    expect(html).toContain('>Choose a new password</');
    expect(html).toContain(
      'You are signed in as a@example.com. Choose a new password for this account.',
    );
    expect(html).not.toContain('This link no longer works');
  });
});
