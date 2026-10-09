import type { Session } from '@nhost/nhost-js/auth';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPasswordPage from '@/auth/password/reset/route';

const auth = vi.hoisted(() => ({
  nhost: {},
  session: null as Session | null,
  isLoading: false,
  linkError: null as string | null,
}));

vi.mock('@/lib/nhost/AuthProvider', () => ({ useAuth: () => auth }));

function render(): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

describe('password reset page', () => {
  beforeEach(() => {
    auth.session = null;
    auth.linkError = null;
  });

  // Only the sign-in mode offers to send a reset link, and the form opens on
  // sign up without an intent.
  it('asks for a new link on the form that can send one', () => {
    const html = render();

    expect(html).toContain('This link no longer works');
    expect(html).toContain('href="/auth/password?intent=sign-in"');
  });

  it('does the same when the link came back with an error', () => {
    auth.linkError = 'That link has expired or was already used.';

    expect(render()).toContain('href="/auth/password?intent=sign-in"');
  });

  // Someone already signed in keeps their session when the link fails, and
  // the form would then change their password on the strength of a dead link.
  it('says the link failed even when someone is signed in', () => {
    auth.session = { user: { email: 'ada@example.com' } } as Session;
    auth.linkError = 'That link has expired or was already used.';

    const html = render();

    expect(html).toContain('This link no longer works');
    expect(html).not.toContain('Choose a new password');
  });
});
