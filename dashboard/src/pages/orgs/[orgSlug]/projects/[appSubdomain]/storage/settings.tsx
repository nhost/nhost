import { SettingsIcon } from 'lucide-react';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import {
  SectionSidebarButton,
  SectionSidebarGroup,
  SectionSidebarNav,
} from '@/components/layout/SectionSidebar';
import { Spinner } from '@/components/ui/v3/spinner';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RateLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RateLimitingForm';
import { useGetRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRateLimits';
import { getStorageLayout } from '@/features/orgs/projects/storage/layout';
import { HasuraStorageAVSettings } from '@/features/orgs/projects/storage/settings/components/StorageAVSettings';
import { StorageServiceVersionSettings } from '@/features/orgs/projects/storage/settings/components/StorageServiceVersionSettings';
import { useGetStorageSettingsQuery } from '@/generated/graphql';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

type StorageSettingsTab = 'storage' | 'rate-limiting';

const STORAGE_SETTINGS_DEFAULT_TAB: StorageSettingsTab = 'storage';

function isStorageSettingsTab(
  value: string | undefined,
): value is StorageSettingsTab {
  return value === 'storage' || value === 'rate-limiting';
}

function getStorageSettingsTab(
  value: string | string[] | undefined,
): StorageSettingsTab {
  const tab = getSingleQueryParam(value);

  if (!isStorageSettingsTab(tab)) {
    return STORAGE_SETTINGS_DEFAULT_TAB;
  }

  return tab;
}

function useStorageSettingsTab() {
  const router = useRouter();
  const activeTab = getStorageSettingsTab(router.query.tab);

  function setActiveTab(nextTab: StorageSettingsTab) {
    const nextQuery = { ...router.query };

    if (nextTab === STORAGE_SETTINGS_DEFAULT_TAB) {
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

function StorageSettingsSidebar() {
  const { activeTab, setActiveTab } = useStorageSettingsTab();

  return (
    <FeatureSidebar
      className="w-[280px] max-w-[280px] border-r-0 bg-background-default"
      mobileBreakpoint="md"
      toggleIcon={<SettingsIcon className="h-4 w-4 text-white" />}
      toggleOffset="left-8"
    >
      <SectionSidebarNav ariaLabel="Storage settings navigation">
        <SectionSidebarGroup label="GENERAL">
          <SectionSidebarButton
            active={activeTab === 'storage'}
            onClick={() => setActiveTab('storage')}
          >
            Storage
          </SectionSidebarButton>
        </SectionSidebarGroup>

        <SectionSidebarGroup label="CONNECTIVITY">
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

function StorageGeneralSettings() {
  const { project, loading: loadingProject } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, error } = useGetStorageSettingsQuery({
    variables: { appId: project?.id },
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  const isInitialLoading = loadingProject || !project?.id || !data;

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading Storage settings...
      </Spinner>
    );
  }

  return (
    <div className="grid grid-flow-row gap-y-6">
      <StorageServiceVersionSettings />
      <HasuraStorageAVSettings />
    </div>
  );
}

function StorageRateLimitingSettings() {
  const { project, loading: loadingProject } = useProject();
  const { storageDefaultValues, loading } = useGetRateLimits();

  if (loadingProject || !project?.id || loading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading Storage rate limit settings...
      </Spinner>
    );
  }

  return (
    <RateLimitingForm
      defaultValues={storageDefaultValues}
      loading={loading}
      serviceName="storage"
      title="Storage"
    />
  );
}

function StorageSettingsContent() {
  const { activeTab } = useStorageSettingsTab();

  if (activeTab === 'rate-limiting') {
    return <StorageRateLimitingSettings />;
  }

  return <StorageGeneralSettings />;
}

export default function StorageSettingsPage() {
  return (
    <SettingsLayout>
      <div className="w-full px-5 py-4">
        <StorageSettingsContent />
      </div>
    </SettingsLayout>
  );
}

StorageSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return getStorageLayout(page, {
    sidebar: <StorageSettingsSidebar />,
    bodyClassName: 'self-center w-full max-w-[1000px]',
    contentClassName: 'flex flex-col',
  });
};
