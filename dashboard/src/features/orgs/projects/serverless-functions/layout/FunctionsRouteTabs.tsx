import { useRouter } from 'next/router';
import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function FunctionsRouteTabs() {
  const router = useRouter();
  const shouldDisableSettings = useSettingsDisabled();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const projectPath = `/orgs/${orgSlug}/projects/${appSubdomain}`;
  const isSettingsActive =
    router.route ===
    '/orgs/[orgSlug]/projects/[appSubdomain]/functions/settings';
  const isFunctionsActive =
    router.route.startsWith(
      '/orgs/[orgSlug]/projects/[appSubdomain]/functions',
    ) && !isSettingsActive;

  return (
    <RouteTabs aria-label="Functions section navigation">
      <RouteTabLink
        href={`${projectPath}/functions`}
        active={isFunctionsActive}
      >
        Functions
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        href={`${projectPath}/functions/settings`}
        active={isSettingsActive}
        disabled={shouldDisableSettings}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
