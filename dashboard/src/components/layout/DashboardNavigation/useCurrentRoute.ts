import { useRouter } from 'next/router';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

/**
 * Match Next.js route templates, not actual URLs: they are known on the first
 * render and tell organization pages (`[orgSlug]`) apart from pages that only
 * sit under `/orgs` (`/orgs/verify`), and existing project pages
 * (`[appSubdomain]`) from the create-project page (`new`). The create-project
 * page should show organization navigation.
 */
const ORG_ROUTE = '/orgs/[orgSlug]';
const PROJECT_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]';

interface CurrentRoute {
  /** Set only on organization routes. */
  orgSlug?: string;
  /** Set only on project routes. */
  appSubdomain?: string;
  isOrgRoute: boolean;
  isProjectRoute: boolean;
}

/**
 * Query params are empty on the first render after a hard navigation, so the
 * slugs fall back to the path segments.
 */
export function useCurrentRoute(): CurrentRoute {
  const { query, asPath, pathname } = useRouter();
  const isOrgRoute = pathname.startsWith(ORG_ROUTE);
  const isProjectRoute = pathname.startsWith(PROJECT_ROUTE);
  const currentPath = asPath.split(/[?#]/)[0];
  const [, , orgSlugFromPath, , appSubdomainFromPath] = currentPath.split('/');

  return {
    orgSlug: isOrgRoute
      ? (getSingleQueryParam(query.orgSlug) ?? orgSlugFromPath)
      : undefined,
    appSubdomain: isProjectRoute
      ? (getSingleQueryParam(query.appSubdomain) ?? appSubdomainFromPath)
      : undefined,
    isOrgRoute,
    isProjectRoute,
  };
}
