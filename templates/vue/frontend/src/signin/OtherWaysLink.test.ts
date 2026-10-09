import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createMemoryHistory, createRouter } from 'vue-router';
import OtherWaysLink from '@/signin/OtherWaysLink.vue';

// Only the count is read, so the entries name no method: a fixture that did
// would fail the delete-method job's grep.
const listed = vi.hoisted(() => ({ methods: [] as object[] }));

vi.mock('@/signin/methods', () => listed);

async function render(query: string): Promise<string> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)', component: { render: () => null } }],
  });
  await router.push('/');

  return renderToString(
    createSSRApp({ render: () => h(OtherWaysLink, { query }) }).use(router),
  );
}

describe('OtherWaysLink', () => {
  beforeEach(() => {
    listed.methods = [{}, {}];
  });

  it('goes back to sign-in carrying the query', async () => {
    expect(await render('?next=%2Fprotected&intent=sign-in')).toContain(
      'href="/signin?next=%2Fprotected&amp;intent=sign-in"',
    );
  });

  it('goes back to the bare sign-in page without a query', async () => {
    expect(await render('')).toContain('href="/signin"');
  });

  // The default `--auth-methods` scaffolds one, so this is the common case.
  it('renders nothing when there is only one method', async () => {
    listed.methods = [{}];

    expect(await render('?intent=sign-in')).not.toContain('<a');
  });
});
