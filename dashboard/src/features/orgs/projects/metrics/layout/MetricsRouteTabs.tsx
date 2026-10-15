import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

/**
 * The Metrics (Grafana) page is platform-only in ProjectGuard, so off-platform
 * its tab is disabled.
 */
export default function MetricsRouteTabs() {
  const isPlatform = useIsPlatform();

  return (
    <RouteTabs aria-label="Metrics section navigation">
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/metrics"
        params
        exact
        disabled={!isPlatform}
      >
        Metrics
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/metrics/settings"
        params
        exact
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
