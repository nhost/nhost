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
import { ServerlessFunctionsDomain } from '@/features/orgs/projects/custom-domains/settings/components/ServerlessFunctionsDomain';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RateLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RateLimitingForm';
import { useGetRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRateLimits';
import { getFunctionsLayout } from '@/features/orgs/projects/serverless-functions/layout';
import { useGetServerlessFunctionsSettingsQuery } from '@/generated/graphql';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

type FunctionsSettingsTab = 'custom-domain' | 'rate-limiting';

const FUNCTIONS_SETTINGS_DEFAULT_TAB: FunctionsSettingsTab = 'custom-domain';

function isFunctionsSettingsTab(
  value: string | undefined,
): value is FunctionsSettingsTab {
  return value === 'custom-domain' || value === 'rate-limiting';
}

function getFunctionsSettingsTab(
  value: string | string[] | undefined,
): FunctionsSettingsTab {
  const tab = getSingleQueryParam(value);

  if (!isFunctionsSettingsTab(tab)) {
    return FUNCTIONS_SETTINGS_DEFAULT_TAB;
  }

  return tab;
}

function useFunctionsSettingsTab() {
  const router = useRouter();
  const activeTab = getFunctionsSettingsTab(router.query.tab);

  function setActiveTab(nextTab: FunctionsSettingsTab) {
    const nextQuery = { ...router.query };

    if (nextTab === FUNCTIONS_SETTINGS_DEFAULT_TAB) {
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

function FunctionsSettingsSidebar() {
  const { activeTab, setActiveTab } = useFunctionsSettingsTab();

  return (
    <FeatureSidebar
      className="w-[280px] max-w-[280px] border-r-0 bg-background-default"
      mobileBreakpoint="md"
      toggleIcon={<SettingsIcon className="h-4 w-4 text-white" />}
      toggleOffset="left-8"
    >
      <SectionSidebarNav ariaLabel="Functions settings navigation">
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

  return <ServerlessFunctionsDomain />;
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

function FunctionsSettingsContent() {
  const { activeTab } = useFunctionsSettingsTab();

  if (activeTab === 'rate-limiting') {
    return <FunctionsRateLimitingSettings />;
  }

  return <FunctionsCustomDomainSettings />;
}

export default function FunctionsSettingsPage() {
  return (
    <SettingsLayout>
      <div className="w-full px-5 py-4">
        <FunctionsSettingsContent />
      </div>
    </SettingsLayout>
  );
}

FunctionsSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return getFunctionsLayout(page, {
    sidebar: <FunctionsSettingsSidebar />,
    bodyClassName: 'self-center w-full max-w-[1000px]',
    contentClassName: 'flex flex-col',
  });
};
