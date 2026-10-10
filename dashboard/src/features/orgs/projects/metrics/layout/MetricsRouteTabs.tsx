import { useRouter } from 'next/router';
import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

/**
 * The Metrics (Grafana) page is platform-only in ProjectGuard, so off-platform
 * its tab is disabled.
 */
export default function MetricsRouteTabs() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const projectPath = `/orgs/${orgSlug}/projects/${appSubdomain}`;

  return (
    <RouteTabs aria-label="Metrics section navigation">
      <RouteTabLink
        href={`${projectPath}/metrics`}
        exact
        disabled={!isPlatform}
      >
        Metrics
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink href={`${projectPath}/metrics/settings`} exact>
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
