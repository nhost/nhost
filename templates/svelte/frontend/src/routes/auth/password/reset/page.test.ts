import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ResetPassword from './+page.svelte';

describe('password reset page', () => {
  // Only the sign-in mode offers to send a reset link, and the form opens on
  // sign up without an intent.
  it('asks for a new link on the form that can send one', () => {
    const { body } = render(ResetPassword, {
      props: { data: { user: null }, params: {} } as never,
    });

    expect(body).toContain('This link no longer works');
    expect(body).toContain('href="/auth/password?intent=sign-in"');
  });
});
