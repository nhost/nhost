import { useRouter } from 'next/router';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

/**
 * The route template, not the resolved path: `/orgs/[orgSlug]/projects/new` is
 * an organization page, but its path is shaped like a project named "new".
 */
const PROJECT_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]';

export interface CurrentRoute {
  /** Current path without query string, hash or trailing slash. */
  currentPath: string;
  orgSlug: string;
  appSubdomain: string;
  isProjectRoute: boolean;
}

/**
 * Query params are empty on the first render after a hard navigation, so the
 * slugs fall back to the path segments.
 */
export function useCurrentRoute(): CurrentRoute {
  const { query, asPath, pathname } = useRouter();
  const currentPath = asPath.split(/[?#]/)[0].replace(/\/$/, '');
  const [, , orgSlugFromPath, , appSubdomainFromPath] = currentPath.split('/');

  return {
    currentPath,
    orgSlug: getSingleQueryParam(query.orgSlug) ?? orgSlugFromPath,
    appSubdomain:
      getSingleQueryParam(query.appSubdomain) ?? appSubdomainFromPath,
    isProjectRoute: pathname.startsWith(PROJECT_ROUTE),
  };
}
