import { SettingsIcon } from 'lucide-react';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import {
  SectionSidebarButton,
  SectionSidebarGroup,
  SectionSidebarNav,
} from '@/components/layout/SectionSidebar';
import { Spinner } from '@/components/ui/v3/spinner';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useRunServices } from '@/features/orgs/projects/common/hooks/useRunServices';
import { RunServiceDomains } from '@/features/orgs/projects/custom-domains/settings/components/RunServiceDomains';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RunServiceLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RunServiceLimitingForm';
import { useGetRunServiceRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRunServiceRateLimits';
import { getRunLayout } from '@/features/orgs/projects/run/layout';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

type RunSettingsTab = 'custom-domain' | 'rate-limiting';

const RUN_SETTINGS_DEFAULT_TAB: RunSettingsTab = 'custom-domain';

function isRunSettingsTab(value: string | undefined): value is RunSettingsTab {
  return value === 'custom-domain' || value === 'rate-limiting';
}

function getRunSettingsTab(
  value: string | string[] | undefined,
): RunSettingsTab {
  const tab = getSingleQueryParam(value);

  if (!isRunSettingsTab(tab)) {
    return RUN_SETTINGS_DEFAULT_TAB;
  }

  return tab;
}

function useRunSettingsTab() {
  const router = useRouter();
  const activeTab = getRunSettingsTab(router.query.tab);

  function setActiveTab(nextTab: RunSettingsTab) {
    const nextQuery = { ...router.query };

    if (nextTab === RUN_SETTINGS_DEFAULT_TAB) {
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

function RunSettingsSidebar() {
  const { activeTab, setActiveTab } = useRunSettingsTab();

  return (
    <FeatureSidebar
      className="w-[280px] max-w-[280px] border-r-0 bg-background-default"
      mobileBreakpoint="md"
      toggleIcon={<SettingsIcon className="h-4 w-4 text-white" />}
      toggleOffset="left-8"
    >
      <SectionSidebarNav ariaLabel="Run settings navigation">
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
    </FeatureSidebar>
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

  return <RunServiceDomains services={services} />;
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

  return (
    <div className="grid grid-flow-row gap-6">
      {services?.map((service) => {
        if (
          service?.ports?.some((port) => port?.type === 'http' && port?.publish)
        ) {
          return (
            <RunServiceLimitingForm
              enabledDefault={service.enabled}
              key={service.id}
              title={service.name}
              serviceId={service.id}
              ports={service.ports}
              loading={loading}
            />
          );
        }

        return null;
      })}
    </div>
  );
}

function RunSettingsContent() {
  const { activeTab } = useRunSettingsTab();

  if (activeTab === 'rate-limiting') {
    return <RunRateLimitingSettings />;
  }

  return <RunCustomDomainSettings />;
}

export default function RunSettingsPage() {
  return (
    <SettingsLayout>
      <div className="w-full px-5 py-4">
        <RunSettingsContent />
      </div>
    </SettingsLayout>
  );
}

RunSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return getRunLayout(page, {
    sidebar: <RunSettingsSidebar />,
    bodyClassName: 'self-center w-full max-w-[1000px]',
    contentClassName: 'flex flex-col',
  });
};
