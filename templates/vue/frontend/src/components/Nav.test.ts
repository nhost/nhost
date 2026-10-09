import { describe, expect, it, vi } from 'vitest';
import { createSSRApp, shallowRef } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createMemoryHistory, createRouter } from 'vue-router';
import Nav from '@/components/Nav.vue';
import { DEFAULT_DESTINATION } from '@/signin/destination';
import { signInQuery } from '@/signin/query';

vi.mock('@/lib/nhost/auth', () => ({
  useAuth: () => ({ session: shallowRef(null) }),
}));

describe('Nav', () => {
  // Built any other way, this link would be left behind by a change to
  // `query.ts` and open on the default mode.
  it('links to sign in through signInQuery', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)', component: { render: () => null } }],
    });
    await router.push('/');

    const html = await renderToString(createSSRApp(Nav).use(router));
    const href = /<a[^>]*href="([^"]*)"[^>]*>Sign in<\/a>/.exec(html)?.[1];

    expect(href).toBe(`/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`);
  });
});
