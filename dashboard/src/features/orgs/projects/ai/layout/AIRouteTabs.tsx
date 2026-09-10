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
  const shouldDisableSettings = useSettingsDisabled();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const projectPath = `/orgs/${orgSlug}/projects/${appSubdomain}`;
  const isAssistantsActive =
    router.route ===
    '/orgs/[orgSlug]/projects/[appSubdomain]/ai/assistants';
  const isFileStoresActive =
    router.route ===
    '/orgs/[orgSlug]/projects/[appSubdomain]/ai/file-stores';
  const isAutoEmbeddingsActive =
    router.route ===
    '/orgs/[orgSlug]/projects/[appSubdomain]/ai/auto-embeddings';
  const isSettingsActive =
    router.route === '/orgs/[orgSlug]/projects/[appSubdomain]/settings/ai';

  return (
    <RouteTabs aria-label="AI section navigation">
      <RouteTabLink
        href={`${projectPath}/ai/assistants`}
        active={isAssistantsActive}
      >
        Agents
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/ai/file-stores`}
        active={isFileStoresActive}
      >
        File Stores
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/ai/auto-embeddings`}
        active={isAutoEmbeddingsActive}
      >
        Auto-Embeddings
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        href={`${projectPath}/settings/ai`}
        active={isSettingsActive}
        disabled={shouldDisableSettings}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
