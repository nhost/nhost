import { useParams } from '@tanstack/react-router';

interface CurrentRoute {
  /** Set only on organization routes. */
  orgSlug?: string;
  /** Set only on project routes. */
  appSubdomain?: string;
  isOrgRoute: boolean;
  isProjectRoute: boolean;
}

/**
 * Organization routes are the ones under `/orgs/$orgSlug`, project routes the
 * ones under `/orgs/$orgSlug/projects/$appSubdomain`. Pages that only sit
 * under `/orgs` (`/orgs/verify`) are separate routes without the params, and
 * the create-project page has no `appSubdomain`, so it shows organization
 * navigation.
 */
export function useCurrentRoute(): CurrentRoute {
  const { orgSlug, appSubdomain } = useParams({ strict: false });

  return {
    orgSlug,
    appSubdomain,
    isOrgRoute: orgSlug !== undefined,
    isProjectRoute: appSubdomain !== undefined,
  };
}
