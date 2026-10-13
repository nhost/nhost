import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ResetPassword from '@/app/auth/password/reset/page';

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({ getUserSession: () => null }),
}));

describe('password reset page', () => {
  // Only the sign-in mode offers to send a reset link, and the form opens on
  // sign up without an intent.
  it('asks for a new link on the form that can send one', async () => {
    const html = renderToStaticMarkup(await ResetPassword());

    expect(html).toContain('This link no longer works');
    expect(html).toContain('href="/auth/password?intent=sign-in"');
  });
});
