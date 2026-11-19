// @vitest-environment happy-dom
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createMemoryHistory,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { routes } from 'vue-router/auto-routes';
import App from '@/App.vue';
import { createAuth } from '@/lib/nhost/auth';
import { createAppRouter } from '@/router';
import { mountAt } from '@/test/mount';

async function mount(path: string): Promise<{ html: string; router: Router }> {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  const { el } = await mountAt(App, path, {
    router,
    plugins: [createAuth({ router, recheck: () => undefined })],
  });
  return { html: el.innerHTML, router };
}

const render = async (path: string): Promise<string> =>
  (await mount(path)).html;

// The source file of every component a route renders.
function routeFiles(records: readonly RouteRecordRaw[]): string[] {
  return records.flatMap((record) => [
    ...(record.component && '__file' in record.component
      ? [String(record.component.__file)]
      : []),
    ...routeFiles(record.children ?? []),
  ]);
}

const notFound = routes.find((route) => route.path === '/:path(.*)')?.component;

describe('router', () => {
  it('serves the home page from app/', async () => {
    expect(await render('/')).toContain('Get started');
  });

  it('shows not found inside the root layout for a path without a page', async () => {
    for (const path of [
      '/nope',
      '/auth',
      '/auth/?x=1#top',
      '/auth/oauth',
      '/auth/nope',
    ]) {
      const { html, router } = await mount(path);
      const route = router.currentRoute.value;

      expect(html).toContain('This page could not be found.');
      expect(html).toContain('<nav');
      expect(route.fullPath).toBe(path);
      expect(route.matched).toHaveLength(1);
      expect(route.matched[0]?.components?.default).toBe(notFound);
    }
  });

  it('makes routes of pages and layouts, not the components beside them', () => {
    const files = routeFiles(routes).map((file) => basename(file));

    expect(files).toContain('index.vue');
    for (const file of files) {
      expect(file).toMatch(/^(?:index|_parent|\[[^\]]+\])\.vue$/);
    }
  });
});
