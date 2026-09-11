import { useRouter } from 'next/router';
import type { ComponentType, ReactElement } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
import { Spinner } from '@/components/ui/v3/spinner';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { CustomDomainsNotice } from '@/features/orgs/projects/custom-domains/settings/components/CustomDomainsNotice';
import { HasuraDomain } from '@/features/orgs/projects/custom-domains/settings/components/HasuraDomain';
import { GraphQLArea } from '@/features/orgs/projects/graphql/layout';
import { HasuraAllowListSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraAllowListSettings';
import { HasuraConsoleSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraConsoleSettings';
import { HasuraCorsDomainSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraCorsDomainSettings';
import { HasuraDevModeSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraDevModeSettings';
import { HasuraEnabledAPISettings } from '@/features/orgs/projects/hasura/settings/components/HasuraEnabledAPISettings';
import { HasuraInferFunctionPermissionsSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraInferFunctionPermissionsSettings';
import { HasuraLogLevelSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraLogLevelSettings';
import { HasuraPoolSizeSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraPoolSizeSettings';
import { HasuraRemoteSchemaPermissionsSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraRemoteSchemaPermissionsSettings';
import { HasuraServiceVersionSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraServiceVersionSettings';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RateLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RateLimitingForm';
import { useGetRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRateLimits';
import { useGetHasuraSettingsQuery } from '@/generated/graphql';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

function GraphQLEngineSettings() {
  return (
    <div className="grid grid-flow-row gap-y-6">
      <HasuraServiceVersionSettings />
      <HasuraLogLevelSettings />
      <HasuraEnabledAPISettings />
      <HasuraPoolSizeSettings />
    </div>
  );
}

function GraphQLAccessSettings() {
  return (
    <div className="grid grid-flow-row gap-y-6">
      <HasuraCorsDomainSettings />
      <HasuraConsoleSettings />
      <HasuraDevModeSettings />
      <HasuraAllowListSettings />
      <HasuraRemoteSchemaPermissionsSettings />
      <HasuraInferFunctionPermissionsSettings />
    </div>
  );
}

function GraphQLCustomDomainSettings() {
  const { org } = useCurrentOrg();

  if (org?.plan?.isFree) {
    return (
      <UpgradeToProBanner
        section="settings-custom-domains"
        title="To unlock Custom Domains, transfer this project to a Pro or Team organization."
        description=""
      />
    );
  }

  return (
    <div className="grid grid-flow-row gap-6">
      <CustomDomainsNotice />
      <HasuraDomain />
    </div>
  );
}

function GraphQLRateLimitingSettings() {
  const { project, loading: loadingProject } = useProject();
  const { hasuraDefaultValues, loading } = useGetRateLimits();

  if (loadingProject || !project?.id || loading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading GraphQL rate limit settings...
      </Spinner>
    );
  }

  return (
    <RateLimitingForm
      defaultValues={hasuraDefaultValues}
      loading={loading}
      serviceName="hasura"
      title="GraphQL"
    />
  );
}

interface GraphQLSettingsTab {
  slug: string;
  label: string;
  Content: ComponentType;
  platformOnly?: boolean;
}

interface GraphQLSettingsGroup {
  label: string;
  tabs: readonly GraphQLSettingsTab[];
}

const GRAPHQL_SETTINGS_GROUPS: readonly GraphQLSettingsGroup[] = [
  {
    label: 'Engine',
    tabs: [
      { slug: 'engine', label: 'Engine', Content: GraphQLEngineSettings },
      {
        slug: 'access-and-tooling',
        label: 'Access and tooling',
        Content: GraphQLAccessSettings,
      },
    ],
  },
  {
    label: 'Connectivity',
    tabs: [
      {
        slug: 'custom-domain',
        label: 'Custom Domain',
        Content: GraphQLCustomDomainSettings,
        platformOnly: true,
      },
      {
        slug: 'rate-limiting',
        label: 'Rate Limiting',
        Content: GraphQLRateLimitingSettings,
      },
    ],
  },
];

const DEFAULT_TAB = GRAPHQL_SETTINGS_GROUPS[0].tabs[0];

/**
 * The active tab lives in `?tab=`; an unknown value, or a platform-only
 * one on self-hosted, falls back to the first tab.
 */
function useGraphQLSettingsTabs() {
  const router = useRouter();
  const isPlatform = useIsPlatform();

  const groups = GRAPHQL_SETTINGS_GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.filter((tab) => isPlatform || !tab.platformOnly),
  })).filter((group) => group.tabs.length > 0);

  const requested = getSingleQueryParam(router.query.tab);
  const activeTab =
    groups
      .flatMap((group) => group.tabs)
      .find((tab) => tab.slug === requested) ?? DEFAULT_TAB;

  function hrefFor(tab: GraphQLSettingsTab) {
    const { tab: _tab, ...query } = router.query;

    return {
      pathname: router.pathname,
      query:
        tab.slug === DEFAULT_TAB.slug ? query : { ...query, tab: tab.slug },
    };
  }

  return { groups, activeTab, hrefFor };
}

function GraphQLSettingsSidebar() {
  const { groups, activeTab, hrefFor } = useGraphQLSettingsTabs();

  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="GraphQL settings navigation">
        {groups.map((group) => (
          <AreaSidebarGroup key={group.label} label={group.label}>
            {group.tabs.map((tab) => (
              <AreaSidebarLink
                key={tab.slug}
                href={hrefFor(tab)}
                active={tab.slug === activeTab.slug}
                shallow
                scroll={false}
              >
                {tab.label}
              </AreaSidebarLink>
            ))}
          </AreaSidebarGroup>
        ))}
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}

export default function GraphQLSettingsPage() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, loading: loadingProject } = useProject();
  const { activeTab } = useGraphQLSettingsTabs();

  const { data, error } = useGetHasuraSettingsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  const isInitialLoading = loadingProject || !project?.id || !data;

  if (isInitialLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <SettingsLayout>
      <activeTab.Content />
    </SettingsLayout>
  );
}

GraphQLSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <GraphQLArea>
          <div className="mx-auto flex h-full w-full max-w-6xl">
            <GraphQLSettingsSidebar />
            <div className="min-w-0 flex-1">{page}</div>
          </div>
        </GraphQLArea>
      </ProjectScope>
    </AppLayout>
  );
};
