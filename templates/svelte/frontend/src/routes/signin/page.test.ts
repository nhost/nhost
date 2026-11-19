import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignIn from './+page.svelte';

const url = vi.hoisted(() => ({ current: 'http://localhost/signin' }));
// No real method is listed, so deleting one leaves nothing here that names it.
const listed = vi.hoisted(() => ({
  methods: [] as object[],
  buttons: [] as unknown[],
}));

vi.mock('$app/state', () => ({
  page: {
    get url() {
      return new URL(url.current);
    },
  },
}));
vi.mock('./methods.ts', () => listed);

function html(search: string, lastUsed: string | null = null): string {
  url.current = `http://localhost/signin${search}`;
  return render(SignIn, {
    props: { data: { lastUsed, user: null }, params: {} } as never,
  }).body;
}

describe('sign-in page', () => {
  beforeEach(async () => {
    listed.methods = [];
    listed.buttons = [];
  });

  // A protected page sends a visitor here with `next` and no intent, so the
  // page opens on sign up.
  it('offers sign in from sign up, keeping next', () => {
    const page = html('?next=%2Fprotected');

    expect(page).toContain('Create an account');
    expect(page).toContain('Already have an account?');
    expect(page).toContain(
      'href="/signin?next=%2Fprotected&amp;intent=sign-in"',
    );
  });

  it('marks the way the visitor last signed in', async () => {
    listed.methods = [
      { href: '/auth/a-method', title: 'A method', description: '' },
      { href: '/auth/b-method', title: 'B method', description: '' },
    ];
    listed.buttons = [(await import('./LastUsedProbe.test.svelte')).default];

    const page = html('', '/auth/b-method');

    expect(page).toMatch(
      /href="\/auth\/b-method"[^>]*>(?:(?!<\/a>).)*Last used/s,
    );
    expect(page.match(/Last used/g)).toHaveLength(1);
    expect(page).toContain('buttons told /auth/b-method');
  });
});
