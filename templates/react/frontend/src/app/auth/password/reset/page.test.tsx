import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import ResetPassword from '@/app/auth/password/reset/page';

describe('password reset page', () => {
  // Only the sign-in mode offers to send a reset link, and the form opens on
  // sign up without an intent.
  it('asks for a new link on the form that can send one', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>,
    );

    expect(html).toContain('This link no longer works');
    expect(html).toContain('href="/auth/password?intent=sign-in"');
  });
});
