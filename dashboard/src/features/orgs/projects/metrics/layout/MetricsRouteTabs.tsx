import { useRouter } from 'next/router';
import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function MetricsRouteTabs() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const shouldDisableSettings = useSettingsDisabled();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const projectPath = `/orgs/${orgSlug}/projects/${appSubdomain}`;
  const isMetricsActive =
    router.route === '/orgs/[orgSlug]/projects/[appSubdomain]/metrics';
  const isSettingsActive =
    router.route === '/orgs/[orgSlug]/projects/[appSubdomain]/metrics/settings';

  return (
    <RouteTabs aria-label="Metrics section navigation">
      <RouteTabLink
        href={`${projectPath}/metrics`}
        active={isMetricsActive}
        disabled={!isPlatform}
      >
        Metrics
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        href={`${projectPath}/metrics/settings`}
        active={isSettingsActive}
        disabled={shouldDisableSettings || !isPlatform}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
