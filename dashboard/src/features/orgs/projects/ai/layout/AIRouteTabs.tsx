import { useRouter } from 'next/router';
import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function AIRouteTabs() {
  const router = useRouter();
  const shouldDisableAI = useSettingsDisabled();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const projectPath = `/orgs/${orgSlug}/projects/${appSubdomain}`;

  return (
    <RouteTabs aria-label="AI section navigation">
      <RouteTabLink
        href={`${projectPath}/ai/assistants`}
        disabled={shouldDisableAI}
      >
        Agents
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/ai/file-stores`}
        disabled={shouldDisableAI}
      >
        File Stores
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/ai/auto-embeddings`}
        disabled={shouldDisableAI}
      >
        Auto-Embeddings
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        href={`${projectPath}/ai/settings`}
        exact
        disabled={shouldDisableAI}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
