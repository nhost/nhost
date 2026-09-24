import { useRouter } from 'next/router';
import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function DatabaseRouteTabs() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const shouldDisableSettings = useSettingsDisabled();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const projectPath = `/orgs/${orgSlug}/projects/${appSubdomain}`;

  return (
    <RouteTabs aria-label="Database section navigation">
      <RouteTabLink href={`${projectPath}/database/browser/default`}>
        Table editor & Browser
      </RouteTabLink>
      <RouteTabLink href={`${projectPath}/database/schema/default`} exact>
        Schema Navigator
      </RouteTabLink>
      <RouteTabLink href={`${projectPath}/database/console/default`} exact>
        SQL Console
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/database/backups`}
        disabled={!isPlatform}
      >
        Backups
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        href={`${projectPath}/database/settings`}
        exact
        disabled={shouldDisableSettings}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
