import { afterEach } from 'vitest';
import {
  type App,
  type Component,
  createApp,
  nextTick,
  type Plugin,
} from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';

export type Mounted = {
  el: HTMLElement;
  app: App;
  router: Router;
  unmount: VoidFunction;
};

const mounted = new Set<Mounted>();

afterEach(() => {
  for (const entry of mounted) {
    entry.unmount();
  }
});

/** A router on `path` that knows every path, for a component that links. */
export async function routerAt(path = '/'): Promise<Router> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:path(.*)*', component: { render: () => null } }],
  });
  await router.push(path);
  return router;
}

/** Lets pending promises settle and Vue render what they changed. */
export async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await nextTick();
}

/**
 * Mounts `component` into the document on a page at `path`, or on `router`
 * where it already is; unmounted after the test.
 */
export async function mountAt(
  component: Component,
  path = '/',
  {
    props = {},
    router,
    plugins = [],
  }: {
    props?: Record<string, unknown>;
    router?: Router;
    plugins?: Plugin[];
  } = {},
): Promise<Mounted> {
  const app = createApp(component, props);
  const on = router ?? (await routerAt(path));
  app.use(on);
  for (const plugin of plugins) {
    app.use(plugin);
  }
  const el = document.body.appendChild(document.createElement('div'));
  app.mount(el);
  const entry: Mounted = {
    el,
    app,
    router: on,
    unmount: () => {
      if (mounted.delete(entry)) {
        app.unmount();
        el.remove();
      }
    },
  };
  mounted.add(entry);
  await settle();
  return entry;
}

/** Where the link labelled `label` goes, or undefined without one. */
export function hrefOf(el: Element, label: string): string | undefined {
  return (
    [...el.querySelectorAll('a')]
      .find((link) => link.textContent?.trim() === label)
      ?.getAttribute('href') ?? undefined
  );
}
