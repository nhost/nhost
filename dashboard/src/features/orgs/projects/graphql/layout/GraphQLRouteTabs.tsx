import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';

export default function GraphQLRouteTabs() {
  const shouldDisableSettings = useSettingsDisabled();

  return (
    <RouteTabs aria-label="GraphQL section navigation">
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/graphql"
        params
        exact
      >
        Playground
      </RouteTabLink>
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/graphql/remote-schemas"
        params
      >
        Remote Schemas
      </RouteTabLink>
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/graphql/actions"
        params
      >
        Actions
      </RouteTabLink>
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/graphql/metadata"
        params
        exact
      >
        Metadata
      </RouteTabLink>
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/graphql/console"
        params
        exact
      >
        Console
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/graphql/settings"
        params
        exact
        disabled={shouldDisableSettings}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
