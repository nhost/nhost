import { useMatch } from '@tanstack/react-router';
import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

/**
 * The Deployments pages are platform-only in ProjectGuard, so off-platform
 * their tab is disabled.
 */
export default function DeploymentsRouteTabs() {
  const isPlatform = useIsPlatform();
  // Deployment details live under /deployments/<id>, so the Deployments tab
  // matches its sub-paths, except on the settings route, which is its sibling.
  const isSettingsRoute =
    useMatch({
      from: '/orgs/$orgSlug/projects/$appSubdomain/deployments/settings',
      shouldThrow: false,
    }) !== undefined;

  return (
    <RouteTabs aria-label="Deployments section navigation">
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/deployments"
        params
        exact={isSettingsRoute}
        disabled={!isPlatform}
      >
        Deployments
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/deployments/settings"
        params
        exact
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
