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
  return (
    <RouteTabs aria-label="Run section navigation">
      <RouteTabLink href={`${projectPath}/run`} exact>
        Services
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        href={`${projectPath}/run/settings`}
        exact
        disabled={shouldDisableSettings}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
