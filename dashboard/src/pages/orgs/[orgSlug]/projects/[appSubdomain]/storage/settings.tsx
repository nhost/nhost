import { useRouter } from 'next/router';
import { type ReactElement, useEffect } from 'react';
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

function StorageSettingsSidebar() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const settingsPath = `/orgs/${orgSlug}/projects/${appSubdomain}/storage/settings`;

  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Storage settings navigation">
        <AreaSidebarGroup label="General">
          <AreaSidebarLink href={`${settingsPath}?tab=storage`} exact shallow>
            Storage
          </AreaSidebarLink>
        </AreaSidebarGroup>
        <AreaSidebarGroup label="Connectivity">
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

export default function StorageSettingsPage() {
  const router = useRouter();
  const tab = router.query.tab;
  const isValidTab =
    typeof tab === 'string' && (tab === 'storage' || tab === 'rate-limiting');

  useEffect(() => {
    if (!router.isReady || isValidTab) {
      return;
    }

    void router.replace(
      { pathname: router.pathname, query: { ...router.query, tab: 'storage' } },
      undefined,
      { shallow: true },
    );
  }, [isValidTab, router]);

  if (!isValidTab) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  switch (tab) {
    case 'rate-limiting':
      return <StorageRateLimitingSettings />;
    default:
      return <StorageGeneralSettings />;
  }
}

StorageSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <StorageArea>
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col pt-8 md:flex-row">
            <StorageSettingsSidebar />
            <div className="min-w-0 flex-1">
              <SettingsGuard>
                <SettingsArea className="pt-0">{page}</SettingsArea>
              </SettingsGuard>
            </div>
          </div>
        </StorageArea>
      </ProjectScope>
    </AppLayout>
  );
};
