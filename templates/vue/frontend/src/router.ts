import {
  createRouter,
  createWebHistory,
  type Router,
  type RouterHistory,
} from 'vue-router';
import { routes } from 'vue-router/auto-routes';

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
    routes,
    // Each new page starts at the top, as Next does, and Back puts it where it
    // was.
    scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
  });
}
