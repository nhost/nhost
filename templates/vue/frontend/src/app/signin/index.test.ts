// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignIn from '@/app/signin/index.vue';
import { hrefOf, mountAt } from '@/test/mount';

// No real method is listed, so deleting one leaves nothing here that names it.
const listed = vi.hoisted(() => ({
  methods: [] as object[],
  buttons: [] as object[],
}));
const lastUsed = vi.hoisted(() => ({ current: null as string | null }));

vi.mock('@/app/signin/methods', () => listed);
vi.mock('@/app/signin/lastUsed', () => ({
  lastUsedSignIn: () => lastUsed.current,
}));

const render = async (search: string) =>
  (await mountAt(SignIn, `/signin${search}`)).el;

describe('sign-in page', () => {
  beforeEach(() => {
    listed.methods = [];
    listed.buttons = [];
    lastUsed.current = null;
  });

  // A protected page sends a visitor here with `next` and no intent, so the
  // page opens on sign up.
  it('offers sign in from sign up, keeping next', async () => {
    const page = await render('?next=%2Fprotected');

    expect(page.textContent).toContain('Create an account');
    expect(page.textContent).toContain('Already have an account?');
    expect(hrefOf(page, 'Sign in')).toBe(
      '/signin?next=%2Fprotected&intent=sign-in',
    );
  });

  it('marks the way the visitor last signed in', async () => {
    const { h } = await import('vue');
    listed.methods = [
      { href: '/auth/a-method', title: 'A method', description: '' },
      { href: '/auth/b-method', title: 'B method', description: '' },
    ];
    listed.buttons = [
      {
        props: ['lastUsed'],
        setup: (props: { lastUsed: string | null }) => () =>
          h('p', `buttons told ${props.lastUsed}`),
      },
    ];
    lastUsed.current = '/auth/b-method';

    const page = await render('');

    expect(
      page.querySelector('a[href="/auth/b-method"]')?.textContent,
    ).toContain('Last used');
    expect(page.textContent?.match(/Last used/g)).toHaveLength(1);
    expect(page.textContent).toContain('buttons told /auth/b-method');
  });
});
