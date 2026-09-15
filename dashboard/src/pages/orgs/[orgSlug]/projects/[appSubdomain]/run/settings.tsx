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
import {
  SettingsCard,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Spinner } from '@/components/ui/v3/spinner';
import { TextLink } from '@/components/ui/v3/text-link';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useRunServices } from '@/features/orgs/projects/common/hooks/useRunServices';
import { CustomDomainsNotice } from '@/features/orgs/projects/custom-domains/settings/components/CustomDomainsNotice';
import { RunServiceDomains } from '@/features/orgs/projects/custom-domains/settings/components/RunServiceDomains';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RunServiceLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RunServiceLimitingForm';
import { useGetRunServiceRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRunServiceRateLimits';
import { RunArea } from '@/features/orgs/projects/run/layout';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

function NoRunServices() {
  const { org } = useCurrentOrg();
  const { project } = useProject();

  return (
    <SettingsCard>
      <SettingsCardHeader title="No Run services yet" />
      <SettingsCardFooter>
        <TextLink
          href={`/orgs/${org?.slug}/projects/${project?.subdomain}/run`}
        >
          Go to Services
        </TextLink>
      </SettingsCardFooter>
    </SettingsCard>
  );
}

function RunCustomDomainSettings() {
  const isPlatform = useIsPlatform();
  const { org } = useCurrentOrg();
  const { project, loading: loadingProject } = useProject();
  const { services, loading } = useRunServices();

  if (isPlatform && org?.plan?.isFree) {
    return (
      <UpgradeToProBanner
        section="settings-custom-domains"
        title="To unlock Custom Domains, transfer this project to a Pro or Team organization."
        description=""
      />
    );
  }

  if (loadingProject || !project?.id || loading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading Run custom domain settings...
      </Spinner>
    );
  }

  const hasServicesWithPorts = services.some(
    (service) => (service.config?.ports?.length ?? 0) > 0,
  );

  return (
    <div className="grid grid-flow-row gap-6">
      <CustomDomainsNotice />
      {hasServicesWithPorts ? (
        <RunServiceDomains services={services} />
      ) : (
        <NoRunServices />
      )}
    </div>
  );
}

function RunRateLimitingSettings() {
  const { project, loading: loadingProject } = useProject();
  const { services, loading } = useGetRunServiceRateLimits();

  if (loadingProject || !project?.id || loading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading Run rate limit settings...
      </Spinner>
    );
  }

  const limitableServices = (services ?? []).filter((service) =>
    service?.ports?.some((port) => port?.type === 'http' && port?.publish),
  );

  if (limitableServices.length === 0) {
    return <NoRunServices />;
  }

  return (
    <div className="grid grid-flow-row gap-6">
      {limitableServices.map((service) => (
        <RunServiceLimitingForm
          enabledDefault={service.enabled}
          key={service.id}
          title={service.name}
          serviceId={service.id}
          ports={service.ports}
          loading={loading}
        />
      ))}
    </div>
  );
}

interface RunSettingsTab {
  slug: string;
  label: string;
  Content: ComponentType;
  platformOnly?: boolean;
}

interface RunSettingsGroup {
  label: string;
  tabs: readonly RunSettingsTab[];
}

const RUN_SETTINGS_GROUPS: readonly RunSettingsGroup[] = [
  {
    label: 'Connectivity',
    tabs: [
      {
        slug: 'custom-domain',
        label: 'Custom Domain',
        Content: RunCustomDomainSettings,
        platformOnly: true,
      },
      {
        slug: 'rate-limiting',
        label: 'Rate Limiting',
        Content: RunRateLimitingSettings,
      },
    ],
  },
];

/**
 * The active tab lives in `?tab=`; an unknown value, or a platform-only one
 * on self-hosted, falls back to the first available tab.
 */
function useRunSettingsTabs() {
  const router = useRouter();
  const isPlatform = useIsPlatform();

  const groups = RUN_SETTINGS_GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.filter((tab) => isPlatform || !tab.platformOnly),
  })).filter((group) => group.tabs.length > 0);

  const tabs = groups.flatMap((group) => group.tabs);
  const defaultTab = tabs[0];
  const requested = getSingleQueryParam(router.query.tab);
  const activeTab = tabs.find((tab) => tab.slug === requested) ?? defaultTab;

  function hrefFor(tab: RunSettingsTab) {
    const { tab: _tab, ...query } = router.query;

    return {
      pathname: router.pathname,
      query: tab.slug === defaultTab.slug ? query : { ...query, tab: tab.slug },
    };
  }

  return { groups, activeTab, hrefFor };
}

function RunSettingsSidebar() {
  const { groups, activeTab, hrefFor } = useRunSettingsTabs();

  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Run settings navigation">
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

export default function RunSettingsPage() {
  const { activeTab } = useRunSettingsTabs();

  return (
    <SettingsLayout>
      <activeTab.Content />
    </SettingsLayout>
  );
}

RunSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <RunArea>
          <div className="mx-auto flex h-full w-full max-w-6xl">
            <RunSettingsSidebar />
            <div className="min-w-0 flex-1">{page}</div>
          </div>
        </RunArea>
      </ProjectScope>
    </AppLayout>
  );
};
