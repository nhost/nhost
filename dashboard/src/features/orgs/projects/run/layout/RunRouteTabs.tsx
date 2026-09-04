import { useRouter } from 'next/router';
import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function RunRouteTabs() {
  const router = useRouter();
  const shouldDisableSettings = useSettingsDisabled();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const projectPath = `/orgs/${orgSlug}/projects/${appSubdomain}`;
  const isServicesActive =
    router.route === '/orgs/[orgSlug]/projects/[appSubdomain]/run';
  const isSettingsActive =
    router.route === '/orgs/[orgSlug]/projects/[appSubdomain]/run/settings';

  return (
    <RouteTabs aria-label="Run section navigation">
      <RouteTabLink href={`${projectPath}/run`} active={isServicesActive}>
        Services
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        href={`${projectPath}/run/settings`}
        active={isSettingsActive}
        disabled={shouldDisableSettings}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
