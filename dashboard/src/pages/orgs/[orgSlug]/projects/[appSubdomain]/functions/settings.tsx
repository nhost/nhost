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
import { ServerlessFunctionsDomain } from '@/features/orgs/projects/custom-domains/settings/components/ServerlessFunctionsDomain';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RateLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RateLimitingForm';
import { useGetRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRateLimits';
import { FunctionsArea } from '@/features/orgs/projects/serverless-functions/layout';
import { useGetServerlessFunctionsSettingsQuery } from '@/generated/graphql';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

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

interface FunctionsSettingsTab {
  slug: string;
  label: string;
  Content: ComponentType;
  platformOnly?: boolean;
}

interface FunctionsSettingsGroup {
  label: string;
  tabs: readonly FunctionsSettingsTab[];
}

const FUNCTIONS_SETTINGS_GROUPS: readonly FunctionsSettingsGroup[] = [
  {
    label: 'Connectivity',
    tabs: [
      {
        slug: 'custom-domain',
        label: 'Custom Domain',
        Content: FunctionsCustomDomainSettings,
        platformOnly: true,
      },
      {
        slug: 'rate-limiting',
        label: 'Rate Limiting',
        Content: FunctionsRateLimitingSettings,
      },
    ],
  },
];

/**
 * The active tab lives in `?tab=`; an unknown value, or a platform-only one
 * on self-hosted, falls back to the first available tab.
 */
function useFunctionsSettingsTabs() {
  const router = useRouter();
  const isPlatform = useIsPlatform();

  const groups = FUNCTIONS_SETTINGS_GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.filter((tab) => isPlatform || !tab.platformOnly),
  })).filter((group) => group.tabs.length > 0);

  const tabs = groups.flatMap((group) => group.tabs);
  const defaultTab = tabs[0];
  const requested = getSingleQueryParam(router.query.tab);
  const activeTab = tabs.find((tab) => tab.slug === requested) ?? defaultTab;

  function hrefFor(tab: FunctionsSettingsTab) {
    const { tab: _tab, ...query } = router.query;

    return {
      pathname: router.pathname,
      query: tab.slug === defaultTab.slug ? query : { ...query, tab: tab.slug },
    };
  }

  return { groups, activeTab, hrefFor };
}

function FunctionsSettingsSidebar() {
  const { groups, activeTab, hrefFor } = useFunctionsSettingsTabs();

  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Functions settings navigation">
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

export default function FunctionsSettingsPage() {
  const { activeTab } = useFunctionsSettingsTabs();

  return (
    <SettingsLayout>
      <activeTab.Content />
    </SettingsLayout>
  );
}

FunctionsSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <FunctionsArea>
          <div className="mx-auto flex h-full w-full max-w-6xl">
            <FunctionsSettingsSidebar />
            <div className="min-w-0 flex-1">{page}</div>
          </div>
        </FunctionsArea>
      </ProjectScope>
    </AppLayout>
  );
};
