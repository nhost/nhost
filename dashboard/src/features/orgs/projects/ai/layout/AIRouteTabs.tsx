import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';

export default function AIRouteTabs() {
  const shouldDisableAI = useSettingsDisabled();

  return (
    <RouteTabs aria-label="AI section navigation">
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/ai/assistants"
        params
        disabled={shouldDisableAI}
      >
        Agents
      </RouteTabLink>
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/ai/file-stores"
        params
        disabled={shouldDisableAI}
      >
        File Stores
      </RouteTabLink>
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/ai/auto-embeddings"
        params
        disabled={shouldDisableAI}
      >
        Auto-Embeddings
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/ai/settings"
        params
        exact
        disabled={shouldDisableAI}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
