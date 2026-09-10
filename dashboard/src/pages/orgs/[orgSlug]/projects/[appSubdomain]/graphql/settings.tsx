import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { UpgradeBanner } from '@/components/common/UpgradeBanner';
import {
  SectionSidebarButton,
  SectionSidebarGroup,
  SectionSidebarNav,
} from '@/components/layout/SectionSidebar';
import { Spinner } from '@/components/ui/v3/spinner';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { HasuraDomain } from '@/features/orgs/projects/custom-domains/settings/components/HasuraDomain';
import { getGraphQLLayout } from '@/features/orgs/projects/graphql/layout';
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

type GraphQLSettingsTab =
  | 'engine'
  | 'access-and-tooling'
  | 'custom-domain'
  | 'rate-limiting';

const GRAPHQL_SETTINGS_DEFAULT_TAB: GraphQLSettingsTab = 'engine';

function isGraphQLSettingsTab(
  value: string | undefined,
): value is GraphQLSettingsTab {
  return (
    value === 'engine' ||
    value === 'access-and-tooling' ||
    value === 'custom-domain' ||
    value === 'rate-limiting'
  );
}

function getGraphQLSettingsTab(
  value: string | string[] | undefined,
): GraphQLSettingsTab {
  const tab = getSingleQueryParam(value);

  if (!isGraphQLSettingsTab(tab)) {
    return GRAPHQL_SETTINGS_DEFAULT_TAB;
  }

  return tab;
}

function useGraphQLSettingsTab() {
  const router = useRouter();
  const activeTab = getGraphQLSettingsTab(router.query.tab);

  function setActiveTab(nextTab: GraphQLSettingsTab) {
    const nextQuery = { ...router.query };

    if (nextTab === GRAPHQL_SETTINGS_DEFAULT_TAB) {
      delete nextQuery.tab;
    } else {
      nextQuery.tab = nextTab;
    }

    void router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  return { activeTab, setActiveTab };
}

function GraphQLSettingsSidebar() {
  const { activeTab, setActiveTab } = useGraphQLSettingsTab();

  return (
    <aside className="h-full w-[240px] max-w-[240px] shrink-0 overflow-auto pt-14">
      <SectionSidebarNav ariaLabel="GraphQL settings navigation">
        <SectionSidebarGroup label="ENGINE">
          <SectionSidebarButton
            active={activeTab === 'engine'}
            onClick={() => setActiveTab('engine')}
          >
            Engine
          </SectionSidebarButton>
          <SectionSidebarButton
            active={activeTab === 'access-and-tooling'}
            onClick={() => setActiveTab('access-and-tooling')}
          >
            Access and tooling
          </SectionSidebarButton>
        </SectionSidebarGroup>

        <SectionSidebarGroup label="CONNECTIVITY">
          <SectionSidebarButton
            active={activeTab === 'custom-domain'}
            onClick={() => setActiveTab('custom-domain')}
          >
            Custom Domain
          </SectionSidebarButton>
          <SectionSidebarButton
            active={activeTab === 'rate-limiting'}
            onClick={() => setActiveTab('rate-limiting')}
          >
            Rate Limiting
          </SectionSidebarButton>
        </SectionSidebarGroup>
      </SectionSidebarNav>
    </aside>
  );
}

function GraphQLCustomDomainSettings() {
  const { org } = useCurrentOrg();

  if (org?.plan?.isFree) {
    return (
      <UpgradeBanner section="settings-custom-domains" />
    );
  }

  return <HasuraDomain />;
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

export default function GraphQLSettingsPage() {
  const { activeTab } = useGraphQLSettingsTab();
  const { project, loading: loadingProject } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

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
      <div className="flex flex-auto items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <SettingsLayout>
      <div className="w-full px-5 pb-4">
        <div className="grid grid-flow-row gap-y-6">
          {activeTab === 'engine' && (
            <>
              <HasuraServiceVersionSettings />
              <HasuraLogLevelSettings />
              <HasuraEnabledAPISettings />
              <HasuraPoolSizeSettings />
            </>
          )}

          {activeTab === 'access-and-tooling' && (
            <>
              <HasuraCorsDomainSettings />
              <HasuraConsoleSettings />
              <HasuraDevModeSettings />
              <HasuraAllowListSettings />
              <HasuraRemoteSchemaPermissionsSettings />
              <HasuraInferFunctionPermissionsSettings />
            </>
          )}

          {activeTab === 'custom-domain' && <GraphQLCustomDomainSettings />}

          {activeTab === 'rate-limiting' && <GraphQLRateLimitingSettings />}
        </div>
      </div>
    </SettingsLayout>
  );
}

GraphQLSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return getGraphQLLayout(page, {
    sidebar: <GraphQLSettingsSidebar />,
    bodyClassName: 'self-center w-full max-w-[1000px]',
    contentClassName: 'flex flex-col',
  });
};
