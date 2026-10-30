import { renderToStaticMarkup } from 'react-dom/server';
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
  lastUsedSignIn: async () => lastUsed.current,
}));

async function render(params: {
  next?: string;
  intent?: string;
}): Promise<string> {
  return renderToStaticMarkup(
    await SignIn({ searchParams: Promise.resolve(params) }),
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
  it('offers sign in from sign up, keeping next', async () => {
    const html = await render({ next: '/protected' });

    expect(html).toContain('Create an account');
    expect(html).toContain('Already have an account?');
    expect(html).toContain(
      'href="/signin?next=%2Fprotected&amp;intent=sign-in"',
    );
  });

  it('marks the way the visitor last signed in', async () => {
    listed.methods = [
      { href: '/auth/a-method', title: 'A method', description: '' },
      { href: '/auth/b-method', title: 'B method', description: '' },
    ];
    listed.buttons = [({ lastUsed }) => `buttons told ${lastUsed}`];
    lastUsed.current = '/auth/b-method';

    const html = await render({});

    expect(html).toMatch(
      /href="\/auth\/b-method"[^>]*>(?:(?!<\/a>).)*Last used/,
    );
    expect(html.match(/Last used/g)).toHaveLength(1);
    expect(html).toContain('buttons told /auth/b-method');
  });
});
