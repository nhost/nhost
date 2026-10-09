// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type App, createApp } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import PasswordRoute from '@/auth/password/route.vue';

vi.mock('@/lib/nhost/auth', () => ({ useAuth: () => ({ nhost: {} }) }));

// Two entries, so "Other ways to sign in" renders. Neither names a method:
// a fixture that did would fail the delete-method job's grep.
vi.mock('@/signin/methods', () => ({ methods: [{}, {}] }));

let app: App;
let router: Router;

// Lets the route change land and the page render what it led to.
const settle = (): Promise<void> => new Promise((done) => setTimeout(done));

const backLink = (): string | null | undefined =>
  [...document.querySelectorAll('a')]
    .find((link) => link.textContent?.trim() === 'Other ways to sign in')
    ?.getAttribute('href');

const button = (label: string): HTMLButtonElement | undefined =>
  [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label,
  );

async function toggle(label: string): Promise<void> {
  button(label)?.click();
  await settle();
}

describe('password page, switching modes', () => {
  beforeEach(async () => {
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)', component: { render: () => null } }],
    });
    await router.push('/');
    await router.push('/auth/password?next=%2Fprotected');

    app = createApp(PasswordRoute).use(router);
    app.mount(document.body.appendChild(document.createElement('div')));
  });

  afterEach(() => {
    app.unmount();
    document.body.innerHTML = '';
  });

  // The back link reads the route, so a mode the visitor switched to only
  // reaches it through the route.
  it('sends the back link to the mode the visitor switched to', async () => {
    expect(backLink()).toBe('/signin?next=%2Fprotected');

    await toggle('I already have an account');

    expect(backLink()).toBe('/signin?next=%2Fprotected&intent=sign-in');

    await toggle('Create an account');

    expect(backLink()).toBe('/signin?next=%2Fprotected');
  });

  // A toggle that pushed would leave an entry per click for Back to step
  // through before leaving the page, and one that moved focus would strand a
  // keyboard or screen-reader user at the top of the document.
  it('switches in place, without a history entry or a focus change', async () => {
    const toggleButton = button('I already have an account');
    toggleButton?.focus();

    await toggle('I already have an account');
    await toggle('Create an account');

    expect(document.activeElement).toBe(toggleButton);

    router.back();
    await settle();

    expect(router.currentRoute.value.path).toBe('/');
  });
});
