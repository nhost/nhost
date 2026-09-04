import { useRouter } from 'next/router';
import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function StorageRouteTabs() {
  const router = useRouter();
  const shouldDisableSettings = useSettingsDisabled();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const projectPath = `/orgs/${orgSlug}/projects/${appSubdomain}`;
  const isSettingsActive =
    router.route === '/orgs/[orgSlug]/projects/[appSubdomain]/storage/settings';
  const isStorageActive =
    router.route.startsWith(
      '/orgs/[orgSlug]/projects/[appSubdomain]/storage',
    ) && !isSettingsActive;

  return (
    <RouteTabs aria-label="Storage section navigation">
      <RouteTabLink href={`${projectPath}/storage`} active={isStorageActive}>
        Storage
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        href={`${projectPath}/storage/settings`}
        active={isSettingsActive}
        disabled={shouldDisableSettings}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
