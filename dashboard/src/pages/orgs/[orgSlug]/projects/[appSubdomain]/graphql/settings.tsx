import { useRouter } from 'next/router';
import { type ReactElement, useEffect } from 'react';
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
import { SettingsGuard } from '@/features/orgs/guards/SettingsGuard';
import { SettingsArea } from '@/features/orgs/projects/common/components/settings/SettingsArea';
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

export default function GraphQLSettingsPage() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, loading: loadingProject } = useProject();
  const tab = router.query.tab;
  const isValidTab =
    typeof tab === 'string' &&
    (tab === 'engine' ||
      tab === 'access-and-tooling' ||
      tab === 'rate-limiting' ||
      tab === 'custom-domain');

  useEffect(() => {
    if (!router.isReady || isValidTab) {
      return;
    }

    void router.replace(
      { pathname: router.pathname, query: { ...router.query, tab: 'engine' } },
      undefined,
      { shallow: true },
    );
  }, [isValidTab, router]);

  const { data, error } = useGetHasuraSettingsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    skip: !project?.id || !isValidTab,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  const isInitialLoading = loadingProject || !project?.id || !data;

  if (!isValidTab || isInitialLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  switch (tab) {
    case 'access-and-tooling':
      return <GraphQLAccessSettings />;
    case 'custom-domain':
      return <GraphQLCustomDomainSettings />;
    case 'rate-limiting':
      return <GraphQLRateLimitingSettings />;
    default:
      return <GraphQLEngineSettings />;
  }
}

GraphQLSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <GraphQLArea>
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col md:flex-row">
            <GraphQLSettingsSidebar />
            <div className="min-w-0 flex-1">
              <SettingsGuard>
                <SettingsArea>{page}</SettingsArea>
              </SettingsGuard>
            </div>
          </div>
        </GraphQLArea>
      </ProjectScope>
    </AppLayout>
  );
};
