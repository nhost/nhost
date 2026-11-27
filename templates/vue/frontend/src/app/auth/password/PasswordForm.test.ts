// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import PasswordForm from '@/app/auth/password/PasswordForm.vue';
import { buttonIn, click, mountAt } from '@/test/mount';

vi.mock('@/app/auth/password/actions', () => ({}));

// "Other ways to sign in" is built from the URL, so a mode the visitor
// switched to only reaches it through the URL.
describe('password form, switching modes', () => {
  it('writes the mode it switched to into the URL, keeping next', async () => {
    const { el, router } = await mountAt(
      PasswordForm,
      '/auth/password?next=%2Fprotected',
      { props: { next: '/protected', intent: 'sign-up' } },
    );
    const url = () => router.currentRoute.value.fullPath;

    await click(buttonIn(el, 'I already have an account'));

    // Vue Router writes the query back in its own encoding.
    expect(url()).toBe('/auth/password?next=/protected&intent=sign-in');

    await click(buttonIn(el, 'Create an account'));

    expect(url()).toBe('/auth/password?next=/protected');
  });
});
