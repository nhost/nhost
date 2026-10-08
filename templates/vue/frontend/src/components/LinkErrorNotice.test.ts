import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, shallowRef } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import LinkErrorNotice from '@/components/LinkErrorNotice.vue';

const linkError = shallowRef<string | null>(null);

vi.mock('@/lib/nhost/auth', () => ({
  useAuth: () => ({
    linkError,
    clearLinkError: () => {
      linkError.value = null;
    },
  }),
}));

const page = { render: () => null };

// The server renderer rather than a DOM, as in `Button.test.ts`: it runs the
// component's setup and says what it renders, which is all this needs.
async function arriveAt(
  path: string,
): Promise<{ html: string; router: Router }> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/signin', '/protected', '/elsewhere'].map((p) => ({
      path: p,
      component: page,
    })),
  });

  await router.push(path);

  const html = await renderToString(createSSRApp(LinkErrorNotice).use(router));

  return { html, router };
}

describe('LinkErrorNotice', () => {
  beforeEach(() => {
    linkError.value = 'That sign-in method is not enabled on the backend yet.';
  });

  // A provider that is not enabled comes back to the page it was asked to,
  // and the visitor has to be told why they are still signed out.
  it('says why the redirect did not sign the visitor in', async () => {
    const { html } = await arriveAt('/');

    expect(html).toContain('role="alert"');
    expect(html).toContain('not enabled on the backend yet');
  });

  it('renders nothing without an error', async () => {
    linkError.value = null;

    const { html } = await arriveAt('/');

    expect(html).not.toContain('role="alert"');
  });

  it('goes once the visitor moves on', async () => {
    const { router } = await arriveAt('/');

    await router.push('/elsewhere');

    expect(linkError.value).toBeNull();
  });

  // A protected page sends a visitor the link did not sign in to sign-in,
  // which is also where they try again, so the reason still applies.
  it('follows the visitor to sign-in', async () => {
    const { router } = await arriveAt('/protected');

    await router.replace('/signin?next=%2Fprotected');

    expect(linkError.value).not.toBeNull();
  });

  // The notice mounts before the router's first navigation, from `/` to
  // wherever the visitor landed, and that is not them moving on.
  it('survives the navigation that brings the visitor in', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/protected', component: page }],
    });

    await renderToString(createSSRApp(LinkErrorNotice).use(router));
    await router.push('/protected');

    expect(linkError.value).not.toBeNull();
  });

  it('stays while the visitor is still on the page they arrived on', async () => {
    const { router } = await arriveAt('/');

    await router.push('/?tab=1');

    expect(linkError.value).not.toBeNull();
  });
});
