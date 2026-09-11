import { useRouter } from 'next/router';
import type { ComponentType, ReactElement } from 'react';
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
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RateLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RateLimitingForm';
import { useGetRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRateLimits';
import { StorageArea } from '@/features/orgs/projects/storage/layout';
import { HasuraStorageAVSettings } from '@/features/orgs/projects/storage/settings/components/StorageAVSettings';
import { StorageServiceVersionSettings } from '@/features/orgs/projects/storage/settings/components/StorageServiceVersionSettings';
import { useGetStorageSettingsQuery } from '@/generated/graphql';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

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

interface StorageSettingsTab {
  slug: string;
  label: string;
  Content: ComponentType;
}

interface StorageSettingsGroup {
  label: string;
  tabs: readonly StorageSettingsTab[];
}

const STORAGE_SETTINGS_GROUPS: readonly StorageSettingsGroup[] = [
  {
    label: 'General',
    tabs: [
      { slug: 'storage', label: 'Storage', Content: StorageGeneralSettings },
    ],
  },
  {
    label: 'Connectivity',
    tabs: [
      {
        slug: 'rate-limiting',
        label: 'Rate Limiting',
        Content: StorageRateLimitingSettings,
      },
    ],
  },
];

const DEFAULT_TAB = STORAGE_SETTINGS_GROUPS[0].tabs[0];

/**
 * The active tab lives in `?tab=`; an unknown value falls back to the first
 * tab.
 */
function useStorageSettingsTabs() {
  const router = useRouter();

  const requested = getSingleQueryParam(router.query.tab);
  const activeTab =
    STORAGE_SETTINGS_GROUPS.flatMap((group) => group.tabs).find(
      (tab) => tab.slug === requested,
    ) ?? DEFAULT_TAB;

  function hrefFor(tab: StorageSettingsTab) {
    const { tab: _tab, ...query } = router.query;

    return {
      pathname: router.pathname,
      query:
        tab.slug === DEFAULT_TAB.slug ? query : { ...query, tab: tab.slug },
    };
  }

  return { activeTab, hrefFor };
}

function StorageSettingsSidebar() {
  const { activeTab, hrefFor } = useStorageSettingsTabs();

  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Storage settings navigation">
        {STORAGE_SETTINGS_GROUPS.map((group) => (
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

export default function StorageSettingsPage() {
  const { activeTab } = useStorageSettingsTabs();

  return (
    <SettingsLayout>
      <activeTab.Content />
    </SettingsLayout>
  );
}

StorageSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <StorageArea>
          <div className="mx-auto flex h-full w-full max-w-6xl">
            <StorageSettingsSidebar />
            <div className="min-w-0 flex-1">{page}</div>
          </div>
        </StorageArea>
      </ProjectScope>
    </AppLayout>
  );
};
