import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
  type Router,
  type RouterHistory,
} from 'vue-router';
import { routes } from 'vue-router/auto-routes';

const notFound = routes.find((route) => route.path === '/:path(.*)');

// A folder with a `_parent.vue` and no `index.vue` has no page of its own, as
// in Next, but Vue Router would match it and render the layout around nothing.
function withNotFound(records: readonly RouteRecordRaw[]): RouteRecordRaw[] {
  return records.map((record) => {
    if (!record.children) {
      return record;
    }
    const children = withNotFound(record.children);
    if (
      record.component &&
      notFound?.component &&
      !children.some((child) => child.path === '')
    ) {
      children.push({ path: '', component: notFound.component });
    }
    return { ...record, children } as RouteRecordRaw;
  });
}

/**
 * The pages in `app/`, read the way Next reads its `app/`: each `index.vue` is
 * the page at its folder's path, inside every `_parent.vue` from `app/` down to
 * it. Anything else is not found, inside `App.vue`.
 */
export function createAppRouter(
  history: RouterHistory = createWebHistory(),
): Router {
  return createRouter({
    history,
    routes: withNotFound(routes),
    // Each new page starts at the top, as Next does, and Back puts it where it
    // was.
    scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
  });
}
