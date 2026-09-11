import { useRouter } from 'next/router';
import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function DeploymentsRouteTabs() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const shouldDisableSettings = useSettingsDisabled();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const projectPath = `/orgs/${orgSlug}/projects/${appSubdomain}`;
  const isSettingsActive =
    router.route ===
    '/orgs/[orgSlug]/projects/[appSubdomain]/deployments/settings';
  const isDeploymentsActive =
    router.route.startsWith(
      '/orgs/[orgSlug]/projects/[appSubdomain]/deployments',
    ) && !isSettingsActive;

  return (
    <RouteTabs aria-label="Deployments section navigation">
      <RouteTabLink
        href={`${projectPath}/deployments`}
        active={isDeploymentsActive}
        disabled={!isPlatform}
      >
        Deployments
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        href={`${projectPath}/deployments/settings`}
        active={isSettingsActive}
        disabled={shouldDisableSettings || !isPlatform}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
