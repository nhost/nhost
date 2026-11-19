// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import ResetPassword from '@/app/auth/password/reset/index.vue';
import { hrefOf, mountAt } from '@/test/mount';

vi.mock('@/lib/nhost/auth', async () => {
  const { computed } = await import('vue');
  return { useSession: () => computed(() => null) };
});

describe('password reset page', () => {
  // Only the sign-in mode offers to send a reset link, and the form opens on
  // sign up without an intent.
  it('asks for a new link on the form that can send one', async () => {
    const { el } = await mountAt(ResetPassword);

    expect(el.textContent).toContain('This link no longer works');
    expect(hrefOf(el, 'Request a new link')).toBe(
      '/auth/password?intent=sign-in',
    );
  });
});
