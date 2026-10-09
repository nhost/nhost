import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SignIn from '@/app/signin/page';

// The switch is what is under test, so no method is listed: a fixture that
// named one would fail the delete-method job's grep.
vi.mock('@/app/signin/methods', () => ({ methods: [] }));

async function render(params: {
  next?: string;
  intent?: string;
}): Promise<string> {
  return renderToStaticMarkup(
    await SignIn({ searchParams: Promise.resolve(params) }),
  );
}

describe('sign-in page', () => {
  // A protected page sends a visitor here with `next` and no intent, so the
  // page opens on sign up. Switching to sign in has to keep `next`, or signing
  // in lands on the home page instead of the page they asked for.
  it('offers sign in from sign up, keeping next', async () => {
    const html = await render({ next: '/protected' });

    expect(html).toContain('Create an account');
    expect(html).toContain('Already have an account?');
    expect(html).toContain(
      'href="/signin?next=%2Fprotected&amp;intent=sign-in"',
    );
  });

  it('offers sign up from sign in, keeping next', async () => {
    const html = await render({ next: '/protected', intent: 'sign-in' });

    expect(html).toContain('New here?');
    expect(html).toContain('href="/signin?next=%2Fprotected"');
  });

  it('switches on the bare page without a next', async () => {
    expect(await render({})).toContain('href="/signin?intent=sign-in"');
    expect(await render({ intent: 'sign-in' })).toContain('href="/signin"');
  });
});
