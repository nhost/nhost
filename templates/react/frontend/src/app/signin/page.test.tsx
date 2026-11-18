import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignIn from '@/app/signin/page';

// No real method is listed, so deleting one leaves nothing here that names it.
const listed = vi.hoisted(() => ({
  methods: [] as object[],
  buttons: [] as ((props: {
    destination: string;
    lastUsed: string | null;
  }) => string)[],
}));
const lastUsed = vi.hoisted(() => ({ current: null as string | null }));

vi.mock('@/app/signin/methods', () => listed);
vi.mock('@/app/signin/lastUsed', () => ({
  lastUsedSignIn: () => lastUsed.current,
}));

function render(search: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/signin${search}`]}>
      <SignIn />
    </MemoryRouter>,
  );
}

describe('sign-in page', () => {
  beforeEach(() => {
    listed.methods = [];
    listed.buttons = [];
    lastUsed.current = null;
  });

  // A protected page sends a visitor here with `next` and no intent, so the
  // page opens on sign up.
  it('offers sign in from sign up, keeping next', () => {
    const html = render('?next=%2Fprotected');

    expect(html).toContain('Create an account');
    expect(html).toContain('Already have an account?');
    expect(html).toContain(
      'href="/signin?next=%2Fprotected&amp;intent=sign-in"',
    );
  });

  it('marks the way the visitor last signed in', () => {
    listed.methods = [
      { href: '/auth/a-method', title: 'A method', description: '' },
      { href: '/auth/b-method', title: 'B method', description: '' },
    ];
    listed.buttons = [({ lastUsed }) => `buttons told ${lastUsed}`];
    lastUsed.current = '/auth/b-method';

    const html = render('');

    expect(html).toMatch(
      /href="\/auth\/b-method"[^>]*>(?:(?!<\/a>).)*Last used/,
    );
    expect(html.match(/Last used/g)).toHaveLength(1);
    expect(html).toContain('buttons told /auth/b-method');
  });
});
