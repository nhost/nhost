import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
import { Spinner } from '@/components/ui/v3/spinner';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { AreaSettingsLayout } from '@/features/orgs/projects/common/layout/AreaSettingsLayout';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RateLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RateLimitingForm';
import { useGetRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRateLimits';
import { HasuraStorageAVSettings } from '@/features/orgs/projects/storage/settings/components/StorageAVSettings';
import { StorageServiceVersionSettings } from '@/features/orgs/projects/storage/settings/components/StorageServiceVersionSettings';
import { useGetStorageSettingsQuery } from '@/generated/graphql';

const storageSettingsTabs = ['storage', 'rate-limiting'] as const;

type StorageSettingsTab = (typeof storageSettingsTabs)[number];

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/storage/settings',
)({
  validateSearch: (search): { tab?: StorageSettingsTab } => ({
    tab: storageSettingsTabs.find((tab) => tab === search.tab),
  }),
  beforeLoad: ({ params, search }) => {
    if (!search.tab) {
      throw redirect({
        to: '/orgs/$orgSlug/projects/$appSubdomain/storage/settings',
        params,
        search: { tab: 'storage' },
        replace: true,
      });
    }
  },
  component: RouteComponent,
});

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

function StorageSettingsSidebar() {
  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Storage settings navigation">
        <AreaSidebarGroup label="General">
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/storage/settings"
            params
            search={{ tab: 'storage' }}
            exact
          >
            Storage
          </AreaSidebarLink>
        </AreaSidebarGroup>
        <AreaSidebarGroup label="Connectivity">
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/storage/settings"
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

function StorageSettingsPage() {
  const { tab } = Route.useSearch();

  switch (tab) {
    case 'rate-limiting':
      return <StorageRateLimitingSettings />;
    default:
      return <StorageGeneralSettings />;
  }
}

function RouteComponent() {
  return (
    <AreaSettingsLayout sidebar={<StorageSettingsSidebar />}>
      <StorageSettingsPage />
    </AreaSettingsLayout>
  );
}
