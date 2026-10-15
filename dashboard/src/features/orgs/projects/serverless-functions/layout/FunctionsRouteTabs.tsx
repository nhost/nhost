import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';

export default function FunctionsRouteTabs() {
  const shouldDisableSettings = useSettingsDisabled();

  return (
    <RouteTabs aria-label="Functions section navigation">
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/functions/browser"
        params
      >
        Functions
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/functions/settings"
        params
        exact
        disabled={shouldDisableSettings}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
