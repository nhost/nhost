import type { ComponentType, ReactNode } from 'react';
import { Outlet, type RouteObject } from 'react-router';
import NotFound from '@/components/NotFound';

type PageModule = { default: ComponentType };
type LayoutModule = { default: ComponentType<{ children: ReactNode }> };

type Dir = {
  page?: PageModule['default'];
  layout?: LayoutModule['default'];
  dirs: Map<string, Dir>;
};

// `./app/auth/[id]/page.tsx` to the directories it sits in: auth, [id].
function dirsOf(file: string): string[] {
  return file.split('/').slice(2, -1);
}

function dirAt(root: Dir, file: string): Dir {
  let dir = root;
  for (const name of dirsOf(file)) {
    let child = dir.dirs.get(name);
    if (!child) {
      child = { dirs: new Map() };
      dir.dirs.set(name, child);
    }
    dir = child;
  }
  return dir;
}

// A `[name]` directory matches any one segment, read with useParams().name.
const segmentOf = (name: string): string => name.replace(/^\[(\w+)\]$/, ':$1');

function routesIn(
  dir: Dir,
  path: string,
  extra: RouteObject[] = [],
): RouteObject[] {
  const routes: RouteObject[] = [];

  if (dir.page) {
    const Page = dir.page;
    routes.push({ path: path || '/', element: <Page /> });
  }

  for (const [name, child] of dir.dirs) {
    routes.push(...routesIn(child, `${path}/${segmentOf(name)}`));
  }

  routes.push(...extra);

  if (!dir.layout) {
    return routes;
  }

  // Pathless, so a directory with a layout and no page matches nothing itself.
  const Layout = dir.layout;
  return [
    {
      element: (
        <Layout>
          <Outlet />
        </Layout>
      ),
      children: routes,
    },
  ];
}

/**
 * Routes from `app/`, the way Next reads it: each `page.tsx` is the page at its
 * directory's path, inside every `layout.tsx` from `app/` down to it. Anything
 * else is not found, inside the root layout.
 */
export function buildRoutes(
  pages: Record<string, PageModule>,
  layouts: Record<string, LayoutModule>,
): RouteObject[] {
  const root: Dir = { dirs: new Map() };

  for (const [file, module] of Object.entries(pages)) {
    dirAt(root, file).page = module.default;
  }
  for (const [file, module] of Object.entries(layouts)) {
    dirAt(root, file).layout = module.default;
  }

  return routesIn(root, '', [{ path: '*', element: <NotFound /> }]);
}

// These globs play the role of Next's filesystem router.
export const routes = buildRoutes(
  import.meta.glob<PageModule>('./app/**/page.tsx', { eager: true }),
  import.meta.glob<LayoutModule>('./app/**/layout.tsx', { eager: true }),
);
