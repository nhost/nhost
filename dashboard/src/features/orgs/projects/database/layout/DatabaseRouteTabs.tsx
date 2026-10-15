import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';

export default function DatabaseRouteTabs() {
  const isPlatform = useIsPlatform();
  const shouldDisableSettings = useSettingsDisabled();

  return (
    <RouteTabs aria-label="Database section navigation">
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug"
        params={(params) => ({ ...params, dataSourceSlug: 'default' })}
      >
        Table editor & Browser
      </RouteTabLink>
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/database/schema/$dataSourceSlug"
        params={(params) => ({ ...params, dataSourceSlug: 'default' })}
        exact
      >
        Schema Navigator
      </RouteTabLink>
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/database/native-queries/$dataSourceSlug"
        params={(params) => ({ ...params, dataSourceSlug: 'default' })}
      >
        Native Queries
      </RouteTabLink>
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/database/console/$dataSourceSlug"
        params={(params) => ({ ...params, dataSourceSlug: 'default' })}
        exact
      >
        SQL Console
      </RouteTabLink>
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/database/backups"
        params
        disabled={!isPlatform}
      >
        Backups
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/database/settings"
        params
        exact
        disabled={shouldDisableSettings}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
