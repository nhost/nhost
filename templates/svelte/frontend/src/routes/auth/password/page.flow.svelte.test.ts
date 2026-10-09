// @vitest-environment happy-dom
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordPage from './+page.svelte';

// Reactive, as SvelteKit's own `page` is, so a navigation re-renders the page.
let url = $state(new URL('http://localhost/'));

vi.mock('$app/state', () => ({
  page: {
    get url() {
      return url;
    },
  },
}));

vi.mock('$app/navigation', () => ({
  goto: async (href: string) => {
    url = new URL(href, url);
  },
}));

vi.mock('$lib/nhost/auth.svelte', () => ({ useAuth: () => ({ nhost: {} }) }));

// Two entries, so "Other ways to sign in" renders. Neither names a method:
// a fixture that did would fail the delete-method job's grep.
vi.mock('$lib/signin/methods', () => ({ methods: [{}, {}] }));

let page: ReturnType<typeof mount>;

const backLink = (): string | null | undefined =>
  [...document.querySelectorAll('a')]
    .find((link) => link.textContent?.trim() === 'Other ways to sign in')
    ?.getAttribute('href');

async function toggle(label: string): Promise<void> {
  [...document.querySelectorAll('button')]
    .find((candidate) => candidate.textContent?.trim() === label)
    ?.click();
  await tick();
  flushSync();
}

describe('password page, switching modes', () => {
  beforeEach(() => {
    url = new URL('http://localhost/auth/password?next=%2Fprotected');
    page = mount(PasswordPage, { target: document.body });
  });

  afterEach(() => {
    unmount(page);
  });

  // The back link reads the URL, so a mode the visitor switched to only
  // reaches it through the URL.
  it('sends the back link to the mode the visitor switched to', async () => {
    expect(backLink()).toBe('/signin?next=%2Fprotected');

    await toggle('I already have an account');

    expect(backLink()).toBe('/signin?next=%2Fprotected&intent=sign-in');

    await toggle('Create an account');

    expect(backLink()).toBe('/signin?next=%2Fprotected');
  });
});
