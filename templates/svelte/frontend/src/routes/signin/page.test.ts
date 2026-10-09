import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import SignInPage from './+page.svelte';

const page = vi.hoisted(() => ({ url: new URL('http://localhost/') }));

vi.mock('$app/state', () => ({ page }));

// The switch is what is under test, so no method is listed: a fixture that
// named one would fail the delete-method job's grep.
vi.mock('$lib/signin/methods', () => ({ methods: [] }));

function html(location: string): string {
  page.url = new URL(location, 'http://localhost');

  return render(SignInPage).body;
}

describe('sign-in page', () => {
  // A protected page sends a visitor here with `next` and no intent, so the
  // page opens on sign up. Switching to sign in has to keep `next`, or signing
  // in lands on the home page instead of the page they asked for.
  it('offers sign in from sign up, keeping next', () => {
    const out = html('/signin?next=%2Fprotected');

    expect(out).toContain('Create an account');
    expect(out).toContain('Already have an account?');
    expect(out).toContain(
      'href="/signin?next=%2Fprotected&amp;intent=sign-in"',
    );
  });

  it('offers sign up from sign in, keeping next', () => {
    const out = html('/signin?next=%2Fprotected&intent=sign-in');

    expect(out).toContain('New here?');
    expect(out).toContain('href="/signin?next=%2Fprotected"');
  });

  it('switches on the bare page without a next', () => {
    expect(html('/signin')).toContain('href="/signin?intent=sign-in"');
    expect(html('/signin?intent=sign-in')).toContain('href="/signin"');
  });
});
