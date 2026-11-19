import { describe, expect, it } from 'vitest';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { type GuardInput, guard } from '@/guard';

const visit = (href: string, rest: Partial<GuardInput> = {}) => {
  const url = new URL(href, 'http://localhost');
  return guard({
    path: url.pathname,
    search: url.search,
    signedIn: false,
    pendingReset: null,
    ...rest,
  });
};

describe('guard, signed out on a protected route', () => {
  it('sends them to sign in and back', () => {
    expect(visit('/account').redirect).toBe('/signin?next=%2Faccount');
  });

  // A provider that is not enabled sends the visitor back to the page they
  // started from, which bounces them to sign-in again.
  it('shows a failed flow on sign-in rather than inside next', () => {
    expect(
      visit('/account?error=disabled-endpoint&errorDescription=x').redirect,
    ).toBe(
      '/signin?next=%2Faccount&error=disabled-endpoint&errorDescription=x',
    );
  });
});

describe('guard for a signed-in visitor', () => {
  it('sends them where the sign-in page was going to', () => {
    expect(
      visit('/signin?next=%2Fprotected&intent=sign-in', { signedIn: true })
        .redirect,
    ).toBe('/protected');
    expect(visit('/auth/magic-link/', { signedIn: true }).redirect).toBe(
      DEFAULT_DESTINATION,
    );
  });

  // `next` is attacker-controlled; it is held to a path on this site.
  it('never sends them off this origin', () => {
    expect(
      visit('/signin?next=%2F%2Fevil.example', { signedIn: true }).redirect,
    ).toBe(DEFAULT_DESTINATION);
  });

  it('leaves the pages under a method alone', () => {
    expect(
      visit('/auth/password/reset', { signedIn: true }).redirect,
    ).toBeUndefined();
  });
});

describe('guard, remembering the way in', () => {
  it('notes the method page a signed-out visitor opens', () => {
    expect(visit('/auth/otp/').record).toBe('/auth/otp');
    expect(visit('/signin').record).toBeUndefined();
    expect(visit('/auth/password/reset').record).toBeUndefined();
  });

  // Wherever the session first shows up: a form's redirect or a link token.
  it('keeps the attempt once a session starts', () => {
    expect(visit('/account', { signedIn: true }).promote).toBe(true);
    expect(visit('/', { signedIn: true }).promote).toBe(true);
    expect(visit('/account').promote).toBeUndefined();
  });
});

describe('guard during a password reset', () => {
  // The link signed them in to choose a password, not to use the account.
  it('sends every other page back to the reset page', () => {
    for (const path of ['/', '/account', '/signin']) {
      expect(
        visit(path, { signedIn: true, pendingReset: '/reset' }).redirect,
      ).toBe('/reset');
    }
    expect(
      visit('/reset', { signedIn: true, pendingReset: '/reset' }).redirect,
    ).toBeUndefined();
  });

  // The marker is the visitor's own to edit.
  it('never sends them off this origin', () => {
    expect(
      visit('/', { signedIn: true, pendingReset: '//evil.example' }).redirect,
    ).toBe(DEFAULT_DESTINATION);
  });

  // The reset tab's session ended and left the marker behind.
  it('ignores a marker without a session', () => {
    expect(visit('/', { pendingReset: '/reset' }).redirect).toBeUndefined();
  });
});
