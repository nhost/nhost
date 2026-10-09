import type { Session } from '@nhost/nhost-js/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Component, createSSRApp, shallowRef } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createMemoryHistory, createRouter } from 'vue-router';
import PasswordChanged from '@/auth/password/reset/PasswordChanged.vue';
import ResetPasswordRoute from '@/auth/password/reset/route.vue';

const session = shallowRef<Session | null>(null);
const linkError = shallowRef<string | null>(null);

vi.mock('@/lib/nhost/auth', () => ({
  useAuth: () => ({ nhost: {}, session, linkError }),
}));

const signedIn = (user?: Partial<Session['user']>): Session =>
  ({ user: user && { id: 'b1946ac9', ...user } }) as Session;

// The server renderer rather than a DOM, as in `LinkErrorNotice.test.ts`.
async function render(page: Component = ResetPasswordRoute): Promise<string> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)', component: { render: () => null } }],
  });

  return renderToString(createSSRApp(page).use(router));
}

describe('password reset page', () => {
  beforeEach(() => {
    session.value = null;
    linkError.value = null;
  });

  it('offers the form to whoever is signed in', async () => {
    session.value = signedIn({ email: 'ada@example.com' });

    const html = await render();

    expect(html).toContain('Choose a new password');
    expect(html).toContain('ada@example.com');
  });

  // Someone already signed in keeps their session when the link fails, and
  // the form would then change their password on the strength of a dead link.
  it('says the link failed even when someone is signed in', async () => {
    session.value = signedIn({ email: 'ada@example.com' });
    linkError.value = 'This link has expired.';

    const html = await render();

    expect(html).toContain('This link no longer works');
    expect(html).not.toContain('Choose a new password');
  });

  it('says the link failed when nobody is signed in', async () => {
    const html = await render();

    expect(html).toContain('This link no longer works');
  });

  // Only the sign-in mode offers to send a reset link, and the form opens on
  // sign up without an intent.
  it('asks for a new link on the form that can send one', async () => {
    expect(await render()).toContain('href="/auth/password?intent=sign-in"');

    linkError.value = 'This link has expired.';

    expect(await render()).toContain('href="/auth/password?intent=sign-in"');
  });

  it('names the account even without a user on the session', async () => {
    session.value = signedIn();

    const html = await render();

    expect(html).toContain('signed in as this account.');
  });
});

describe('password changed card', () => {
  it('sends them to sign in with the new password', async () => {
    const html = await render(PasswordChanged);

    expect(html).toContain('Password changed');
    expect(html).toContain('signed you out everywhere');
    expect(html).toContain('href="/auth/password?intent=sign-in"');
  });
});
