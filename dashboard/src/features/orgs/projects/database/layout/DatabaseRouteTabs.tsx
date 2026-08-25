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
  const isSqlConsoleActive =
    router.route ===
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/browser/[dataSourceSlug]/editor';
  const isTableEditorActive =
    router.route.startsWith(
      '/orgs/[orgSlug]/projects/[appSubdomain]/database/browser/',
    ) && !isSqlConsoleActive;
  const isSchemaNavigatorActive = router.route.startsWith(
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/schema/',
  );
  const isBackupsActive = router.route.startsWith(
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/backups',
  );
  const isSettingsActive =
    router.route ===
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/settings';

  return (
    <RouteTabs aria-label="Database section navigation">
      <RouteTabLink
        href={`${projectPath}/database/browser/default`}
        active={isTableEditorActive}
      >
        Table editor & Browser
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/database/schema/default`}
        active={isSchemaNavigatorActive}
      >
        Schema Navigator
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/database/browser/default/editor`}
        active={isSqlConsoleActive}
      >
        SQL Console
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/database/backups`}
        active={isBackupsActive}
        disabled={!isPlatform}
      >
        Backups
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        href={`${projectPath}/database/settings`}
        active={isSettingsActive}
        disabled={shouldDisableSettings}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
