import { describe, expect, it, vi } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createMemoryHistory, createRouter } from 'vue-router';
import SignInPage from '@/signin/SignInPage.vue';

// The switch is what is under test, so no method is listed: a fixture that
// named one would fail the delete-method job's grep.
vi.mock('@/signin/methods', () => ({ methods: [] }));

async function render(location: string): Promise<string> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)', component: { render: () => null } }],
  });
  await router.push(location);

  return renderToString(createSSRApp(SignInPage).use(router));
}

describe('SignInPage', () => {
  // A protected page sends a visitor here with `next` and no intent, so the
  // page opens on sign up. Switching to sign in has to keep `next`, or signing
  // in lands on the home page instead of the page they asked for.
  it('offers sign in from sign up, keeping next', async () => {
    const html = await render('/signin?next=%2Fprotected');

    expect(html).toContain('Create an account');
    expect(html).toContain('Already have an account?');
    expect(html).toContain(
      'href="/signin?next=%2Fprotected&amp;intent=sign-in"',
    );
  });

  it('offers sign up from sign in, keeping next', async () => {
    const html = await render('/signin?next=%2Fprotected&intent=sign-in');

    expect(html).toContain('New here?');
    expect(html).toContain('href="/signin?next=%2Fprotected"');
  });

  it('switches on the bare page without a next', async () => {
    expect(await render('/signin')).toContain('href="/signin?intent=sign-in"');
    expect(await render('/signin?intent=sign-in')).toContain('href="/signin"');
  });
});
