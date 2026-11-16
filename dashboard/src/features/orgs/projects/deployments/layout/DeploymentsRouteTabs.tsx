import { useRouter } from 'next/router';
import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

/**
 * The Deployments pages are platform-only in ProjectGuard, so off-platform
 * their tab is disabled.
 */
export default function DeploymentsRouteTabs() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const projectPath = `/orgs/${orgSlug}/projects/${appSubdomain}`;
  // Deployment details live under /deployments/<id>, so the Deployments tab
  // matches its sub-paths, except on the settings route, which is its sibling.
  const isSettingsRoute =
    router.route ===
    '/orgs/[orgSlug]/projects/[appSubdomain]/deployments/settings';

  return (
    <RouteTabs aria-label="Deployments section navigation">
      <RouteTabLink
        href={`${projectPath}/deployments`}
        exact={isSettingsRoute}
        disabled={!isPlatform}
      >
        Deployments
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink href={`${projectPath}/deployments/settings`} exact>
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
