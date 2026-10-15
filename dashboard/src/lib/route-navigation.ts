import { useRouterState } from '@tanstack/react-router';

function normalizePath(path: string) {
  return path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}

function getQueryString(href: string) {
  const withoutHash = href.split('#')[0];
  const queryStart = withoutHash.indexOf('?');
  return queryStart === -1 ? '' : withoutHash.slice(queryStart + 1);
}

/**
 * Whether every search param of `targetQuery` has the same values in
 * `currentQuery`. Params only present in `currentQuery` are ignored.
 */
export function isQueryActive(currentQuery: string, targetQuery: string) {
  const current = new URLSearchParams(currentQuery);
  const target = new URLSearchParams(targetQuery);

  return Array.from(new Set(target.keys())).every((key) => {
    const currentValues = current.getAll(key);
    const targetValues = target.getAll(key);
    return (
      currentValues.length === targetValues.length &&
      targetValues.every((value, index) => value === currentValues[index])
    );
  });
}

/**
 * Whether `href` points at the current location `currentHref`. Without
 * `exact`, pages below `href` count too and search params are ignored; with
 * `exact`, the path has to match and so do the search params `href` sets.
 */
export function isRouteActive(
  currentHref: string,
  href: string,
  exact = false,
) {
  const currentPath = normalizePath(currentHref);
  const targetPath = normalizePath(href);

  return (
    (currentPath === targetPath ||
      (!exact && currentPath.startsWith(`${targetPath}/`))) &&
    (!exact || isQueryActive(getQueryString(currentHref), getQueryString(href)))
  );
}

/**
 * The current location's path, search and hash, e.g.
 * `/orgs/acme/projects/app/settings?tab=general`.
 */
export function useCurrentHref() {
  return useRouterState({ select: (state) => state.location.href });
}

/**
 * The route full path of the page being shown, e.g.
 * `/orgs/$orgSlug/projects/$appSubdomain/graphql/` (index routes end with `/`).
 */
export function useCurrentPagePath(): string | undefined {
  return useRouterState({
    select: (state) => state.matches.at(-1)?.fullPath,
  });
}

interface UseIsLinkActiveOptions {
  /** The href a router link built, `undefined` for a disabled link. */
  href: string | undefined;
  /** Matches instead of `href`, for links that stand for a whole section. */
  activePath?: string;
  exact?: boolean;
  /** The `aria-current` the router set; used when there is no href. */
  ariaCurrent?: unknown;
}

/**
 * Active state for the dashboard's router link components, using
 * `isRouteActive` so section links, tabs and settings links keep their
 * matching rules. A disabled link has no href, so the router's own active
 * flag is used for it.
 */
export function useIsLinkActive({
  href,
  activePath,
  exact = false,
  ariaCurrent,
}: UseIsLinkActiveOptions) {
  const currentHref = useCurrentHref();
  const target = activePath ?? href;

  if (target === undefined) {
    return ariaCurrent === 'page';
  }

  return isRouteActive(currentHref, target, exact);
}
