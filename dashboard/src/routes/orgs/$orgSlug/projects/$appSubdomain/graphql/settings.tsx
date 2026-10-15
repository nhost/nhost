import { createFileRoute, redirect } from '@tanstack/react-router';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
import { Spinner } from '@/components/ui/v3/spinner';
import { AreaSettingsLayout } from '@/features/orgs/projects/common/layout/AreaSettingsLayout';
import { CustomDomainsNotice } from '@/features/orgs/projects/custom-domains/settings/components/CustomDomainsNotice';
import { HasuraDomain } from '@/features/orgs/projects/custom-domains/settings/components/HasuraDomain';
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
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RateLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RateLimitingForm';
import { useGetRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRateLimits';

const graphQLSettingsTabs = [
  'engine',
  'access-and-tooling',
  'rate-limiting',
  'custom-domain',
] as const;

type GraphQLSettingsTab = (typeof graphQLSettingsTabs)[number];

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/settings',
)({
  validateSearch: (search): { tab?: GraphQLSettingsTab } => ({
    tab: graphQLSettingsTabs.find((tab) => tab === search.tab),
  }),
  beforeLoad: ({ params, search }) => {
    if (!search.tab) {
      throw redirect({
        to: '/orgs/$orgSlug/projects/$appSubdomain/graphql/settings',
        params,
        search: { tab: 'engine' },
        replace: true,
      });
    }
  },
  component: RouteComponent,
});

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
  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="GraphQL settings navigation">
        <AreaSidebarGroup label="Engine">
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/graphql/settings"
            params
            search={{ tab: 'engine' }}
            exact
          >
            Engine
          </AreaSidebarLink>
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/graphql/settings"
            params
            search={{ tab: 'access-and-tooling' }}
            exact
          >
            Access and tooling
          </AreaSidebarLink>
        </AreaSidebarGroup>
        <AreaSidebarGroup label="Connectivity">
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/graphql/settings"
            params
            search={{ tab: 'custom-domain' }}
            exact
          >
            Custom Domain
          </AreaSidebarLink>
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/graphql/settings"
            params
            search={{ tab: 'rate-limiting' }}
            exact
          >
            Rate Limiting
          </AreaSidebarLink>
        </AreaSidebarGroup>
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}

function GraphQLSettingsPage() {
  const { tab } = Route.useSearch();

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

function RouteComponent() {
  return (
    <AreaSettingsLayout sidebar={<GraphQLSettingsSidebar />}>
      <GraphQLSettingsPage />
    </AreaSettingsLayout>
  );
}
