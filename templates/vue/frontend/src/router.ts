import {
  createRouter,
  createWebHistory,
  type RouteLocationAsRelativeGeneric,
  type RouteLocationGeneric,
  type RouteLocationRaw,
  type RouteRecordRaw,
  type Router,
  type RouterHistory,
} from 'vue-router';
import { routes } from 'vue-router/auto-routes';

const notFound = routes.find((route) => route.path === '/:path(.*)');

// The not-found page inside `App.vue` only, reached by name. Its param repeats,
// so a path keeps its slashes when Vue Router builds the URL from it.
const NOT_FOUND = Symbol('not found');

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

// `to.path` is encoded, and Vue Router encodes params again.
function notFoundAt(to: RouteLocationGeneric): RouteLocationRaw {
  const location: RouteLocationAsRelativeGeneric = {
    name: NOT_FOUND,
    params: { path: to.path.slice(1).split('/').map(decodeSegment) },
  };
  // The generated route types know only the names of the files in `app/`.
  return location as RouteLocationRaw;
}

// A folder with a `_parent.vue` and no `index.vue` has no page of its own, as
// in Next, but Vue Router would match it and render the layout around nothing.
// Sending it to the not-found page by name keeps the URL and drops the layout.
function withNotFound(records: readonly RouteRecordRaw[]): RouteRecordRaw[] {
  return records.map((record) => {
    if (!record.children) {
      return record;
    }
    const children = withNotFound(record.children);
    if (record.component && !children.some((child) => child.path === '')) {
      children.push({ path: '', redirect: notFoundAt });
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
    routes: notFound?.component
      ? [
          ...withNotFound(routes),
          {
            path: '/:path(.*)*',
            name: NOT_FOUND,
            component: notFound.component,
          },
        ]
      : routes,
    // Each new page starts at the top, as Next does, and Back puts it where it
    // was. A change to the query alone, such as a form switching its mode,
    // stays where it is.
    scrollBehavior: (to, from, savedPosition) =>
      savedPosition ?? (to.path === from.path ? false : { top: 0 }),
  });
}
