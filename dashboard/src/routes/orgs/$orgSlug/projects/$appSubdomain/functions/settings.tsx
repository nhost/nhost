import { createFileRoute, redirect } from '@tanstack/react-router';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
import { Spinner } from '@/components/ui/v3/spinner';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { AreaSettingsLayout } from '@/features/orgs/projects/common/layout/AreaSettingsLayout';
import { CustomDomainsNotice } from '@/features/orgs/projects/custom-domains/settings/components/CustomDomainsNotice';
import { ServerlessFunctionsDomain } from '@/features/orgs/projects/custom-domains/settings/components/ServerlessFunctionsDomain';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RateLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RateLimitingForm';
import { useGetRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRateLimits';
import { useGetServerlessFunctionsSettingsQuery } from '@/generated/graphql';

const functionsSettingsTabs = ['rate-limiting', 'custom-domain'] as const;

type FunctionsSettingsTab = (typeof functionsSettingsTabs)[number];

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/functions/settings',
)({
  validateSearch: (search): { tab?: FunctionsSettingsTab } => ({
    tab: functionsSettingsTabs.find((tab) => tab === search.tab),
  }),
  beforeLoad: ({ params, search }) => {
    if (!search.tab) {
      throw redirect({
        to: '/orgs/$orgSlug/projects/$appSubdomain/functions/settings',
        params,
        search: { tab: 'custom-domain' },
        replace: true,
      });
    }
  },
  component: RouteComponent,
});

function FunctionsCustomDomainSettings() {
  const { org } = useCurrentOrg();
  const { project, loading: loadingProject } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const shouldShowUpgrade = isPlatform && !!org?.plan?.isFree;

  const { data, error } = useGetServerlessFunctionsSettingsQuery({
    variables: { appId: project?.id },
    skip: shouldShowUpgrade || !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (shouldShowUpgrade) {
    return (
      <UpgradeToProBanner
        section="settings-custom-domains"
        title="To unlock Custom Domains, transfer this project to a Pro or Team organization."
        description=""
      />
    );
  }

  if (error) {
    throw error;
  }

  const isInitialLoading = loadingProject || !project?.id || !data;

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading Functions custom domain settings...
      </Spinner>
    );
  }

  return (
    <div className="grid grid-flow-row gap-6">
      <CustomDomainsNotice />
      <ServerlessFunctionsDomain />
    </div>
  );
}

function FunctionsRateLimitingSettings() {
  const { project, loading: loadingProject } = useProject();
  const { functionsDefaultValues, loading } = useGetRateLimits();

  if (loadingProject || !project?.id || loading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading Functions rate limit settings...
      </Spinner>
    );
  }

  return (
    <RateLimitingForm
      defaultValues={functionsDefaultValues}
      loading={loading}
      serviceName="functions"
      title="Functions"
    />
  );
}

function FunctionsSettingsSidebar() {
  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Functions settings navigation">
        <AreaSidebarGroup label="Connectivity">
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/functions/settings"
            params
            search={{ tab: 'custom-domain' }}
            exact
            resetScroll={false}
          >
            Custom Domain
          </AreaSidebarLink>
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/functions/settings"
            params
            search={{ tab: 'rate-limiting' }}
            exact
            resetScroll={false}
          >
            Rate Limiting
          </AreaSidebarLink>
        </AreaSidebarGroup>
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}

function FunctionsSettingsPage() {
  const { tab } = Route.useSearch();

  switch (tab) {
    case 'rate-limiting':
      return <FunctionsRateLimitingSettings />;
    default:
      return <FunctionsCustomDomainSettings />;
  }
}

function RouteComponent() {
  return (
    <AreaSettingsLayout sidebar={<FunctionsSettingsSidebar />}>
      <FunctionsSettingsPage />
    </AreaSettingsLayout>
  );
}
