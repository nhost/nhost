import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import SignInPage from '@/signin/SignInPage';

// The switch is what is under test, so no method is listed: a fixture that
// named one would fail the delete-method job's grep.
vi.mock('@/signin/methods', () => ({ methods: [] }));

function render(location: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[location]}>
      <SignInPage />
    </MemoryRouter>,
  );
}

describe('SignInPage', () => {
  // A protected page sends a visitor here with `next` and no intent, so the
  // page opens on sign up. Switching to sign in has to keep `next`, or signing
  // in lands on the home page instead of the page they asked for.
  it('offers sign in from sign up, keeping next', () => {
    const html = render('/signin?next=%2Fprotected');

    expect(html).toContain('Create an account');
    expect(html).toContain('Already have an account?');
    expect(html).toContain(
      'href="/signin?next=%2Fprotected&amp;intent=sign-in"',
    );
  });

  it('offers sign up from sign in, keeping next', () => {
    const html = render('/signin?next=%2Fprotected&intent=sign-in');

    expect(html).toContain('New here?');
    expect(html).toContain('href="/signin?next=%2Fprotected"');
  });

  it('switches on the bare page without a next', () => {
    expect(render('/signin')).toContain('href="/signin?intent=sign-in"');
    expect(render('/signin?intent=sign-in')).toContain('href="/signin"');
  });
});
