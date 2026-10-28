import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
import { Spinner } from '@/components/ui/v3/spinner';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import {
  type SettingsTab,
  SettingsTabs,
} from '@/features/orgs/projects/common/components/settings/SettingsTabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { AreaSettingsLayout } from '@/features/orgs/projects/common/layout/AreaSettingsLayout';
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
      description="Limit how many requests each IP address can send to the GraphQL API. Used requests come back gradually over the interval."
    />
  );
}

function GraphQLSettingsSidebar() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const settingsPath = `/orgs/${orgSlug}/projects/${appSubdomain}/graphql/settings`;

  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="GraphQL settings navigation">
        <AreaSidebarGroup label="Engine">
          <AreaSidebarLink href={`${settingsPath}?tab=engine`} exact shallow>
            Engine
          </AreaSidebarLink>
          <AreaSidebarLink
            href={`${settingsPath}?tab=access-and-tooling`}
            exact
            shallow
          >
            Access and tooling
          </AreaSidebarLink>
        </AreaSidebarGroup>
        <AreaSidebarGroup label="Connectivity">
          <AreaSidebarLink
            href={`${settingsPath}?tab=custom-domain`}
            exact
            shallow
          >
            Custom Domain
          </AreaSidebarLink>
          <AreaSidebarLink
            href={`${settingsPath}?tab=rate-limiting`}
            exact
            shallow
          >
            Rate Limiting
          </AreaSidebarLink>
        </AreaSidebarGroup>
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}

const GRAPHQL_SETTINGS_TABS = {
  engine: { title: 'Engine', Component: GraphQLEngineSettings },
  'access-and-tooling': {
    title: 'Access and tooling',
    Component: GraphQLAccessSettings,
  },
  'custom-domain': {
    title: 'Custom Domain',
    Component: GraphQLCustomDomainSettings,
  },
  'rate-limiting': {
    title: 'Rate Limiting',
    Component: GraphQLRateLimitingSettings,
  },
} satisfies Record<string, SettingsTab>;

export default function GraphQLSettingsPage() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, loading: loadingProject } = useProject();

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

  return <SettingsTabs tabs={GRAPHQL_SETTINGS_TABS} defaultTab="engine" />;
}

GraphQLSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <GraphQLArea>
          <AreaSettingsLayout sidebar={<GraphQLSettingsSidebar />}>
            {page}
          </AreaSettingsLayout>
        </GraphQLArea>
      </ProjectScope>
    </AppLayout>
  );
};
