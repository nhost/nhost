import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';

export default function AuthRouteTabs() {
  const shouldDisableSettings = useSettingsDisabled();
  return (
    <RouteTabs aria-label="Auth section navigation">
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/auth/users"
        params
        exact
      >
        Users
      </RouteTabLink>
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/auth/oauth2-clients"
        params
        exact
      >
        OAuth2 Clients
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/auth/settings"
        params
        exact
        disabled={shouldDisableSettings}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
