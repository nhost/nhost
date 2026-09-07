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
  const aiRoute = '/orgs/[orgSlug]/projects/[appSubdomain]/ai';
  const isAgentsActive = router.route.startsWith(`${aiRoute}/assistants`);
  const isFileStoresActive = router.route.startsWith(`${aiRoute}/file-stores`);
  const isAutoEmbeddingsActive = router.route.startsWith(
    `${aiRoute}/auto-embeddings`,
  );
  const isSettingsActive = router.route === `${aiRoute}/settings`;

  return (
    <RouteTabs aria-label="AI section navigation">
      <RouteTabLink
        href={`${projectPath}/ai/assistants`}
        active={isAgentsActive}
        disabled={shouldDisableAI}
      >
        Agents
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/ai/file-stores`}
        active={isFileStoresActive}
        disabled={shouldDisableAI}
      >
        File Stores
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/ai/auto-embeddings`}
        active={isAutoEmbeddingsActive}
        disabled={shouldDisableAI}
      >
        Auto-Embeddings
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        href={`${projectPath}/ai/settings`}
        active={isSettingsActive}
        disabled={shouldDisableAI}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
