// @vitest-environment happy-dom
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory, type RouteRecordRaw } from 'vue-router';
import { routes } from 'vue-router/auto-routes';
import App from '@/App.vue';
import { createAuth } from '@/lib/nhost/auth';
import { createAppRouter } from '@/router';
import { mountAt } from '@/test/mount';

async function render(path: string): Promise<string> {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  return (
    await mountAt(App, path, {
      router,
      plugins: [createAuth({ router, recheck: () => undefined })],
    })
  ).el.innerHTML;
}

// The source file of every component a route renders.
function routeFiles(records: readonly RouteRecordRaw[]): string[] {
  return records.flatMap((record) => [
    ...(record.component && '__file' in record.component
      ? [String(record.component.__file)]
      : []),
    ...routeFiles(record.children ?? []),
  ]);
}

describe('router', () => {
  it('serves the home page from app/', async () => {
    expect(await render('/')).toContain('Get started');
  });

  it('shows not found inside the root layout for a path without a page', async () => {
    for (const path of ['/nope', '/auth', '/auth/nope']) {
      const html = await render(path);

      expect(html).toContain('This page could not be found.');
      expect(html).toContain('<nav');
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
