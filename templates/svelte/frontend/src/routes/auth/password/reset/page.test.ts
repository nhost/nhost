import type { Session } from '@nhost/nhost-js/auth';
import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPasswordPage from './+page.svelte';
import PasswordChanged from './PasswordChanged.svelte';

const auth = vi.hoisted(() => ({
  nhost: {},
  session: null as unknown,
  linkError: null as string | null,
}));

vi.mock('$lib/nhost/auth.svelte', () => ({ useAuth: () => auth }));

const signedIn = (user?: Partial<Session['user']>): Session =>
  ({ user: user && { id: 'b1946ac9', ...user } }) as Session;

const html = (): string => render(ResetPasswordPage).body;

describe('password reset page', () => {
  beforeEach(() => {
    auth.session = null;
    auth.linkError = null;
  });

  it('offers the form to whoever is signed in', () => {
    auth.session = signedIn({ email: 'ada@example.com' });

    const out = html();

    expect(out).toContain('Choose a new password');
    expect(out).toContain('ada@example.com');
    expect(out).not.toContain('The link signed you in');
  });

  // Someone already signed in keeps their session when the link fails, and
  // the form would then change their password on the strength of a dead link.
  it('says the link failed even when someone is signed in', () => {
    auth.session = signedIn({ email: 'ada@example.com' });
    auth.linkError = 'That link has expired or was already used.';

    const out = html();

    expect(out).toContain('This link no longer works');
    expect(out).not.toContain('Choose a new password');
  });

  it('says the link failed when nobody is signed in', () => {
    const out = html();

    expect(out).toContain('This link no longer works');
    expect(out).toContain('It has expired or was already used.');
  });

  // Only the sign-in mode offers to send a reset link, and the form opens on
  // sign up without an intent.
  it('asks for a new link on the form that can send one', () => {
    expect(html()).toContain('href="/auth/password?intent=sign-in"');

    auth.linkError = 'That link has expired or was already used.';

    expect(html()).toContain('href="/auth/password?intent=sign-in"');
  });

  it('names the account even without a user on the session', () => {
    auth.session = signedIn();

    expect(html()).toContain('this account');
  });
});

describe('password changed card', () => {
  it('sends them to sign in with the new password', () => {
    const out = render(PasswordChanged).body;

    expect(out).toContain('Password changed');
    expect(out).toContain('signed you out everywhere');
    expect(out).toContain('href="/auth/password?intent=sign-in"');
  });
});
