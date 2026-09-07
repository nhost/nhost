import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { type ReactElement, useMemo } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Alert } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { FileStoresIcon } from '@/components/ui/v3/icons/FileStoresIcon';
import { Spinner } from '@/components/ui/v3/spinner';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { AISidebar } from '@/features/orgs/layout/AISidebar';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { FileStoreForm } from '@/features/orgs/projects/ai/FileStoreForm';
import { FileStoresList } from '@/features/orgs/projects/ai/FileStoresList';
import type { GraphiteFileStore } from '@/features/orgs/projects/ai/file-stores/types';
import { useIsFileStoreSupported } from '@/features/orgs/projects/common/hooks/useIsFileStoreSupported';
import { useIsGraphiteEnabled } from '@/features/orgs/projects/common/hooks/useIsGraphiteEnabled';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetGraphiteFileStoresQuery } from '@/generated/graphite';

export default function FileStoresPage() {
  const { openDrawer } = useDialog();
  const isPlatform = useIsPlatform();

  const { org, loading: loadingOrg } = useCurrentOrg();
  const { project, loading: loadingProject } = useProject();

  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const { isGraphiteEnabled, loading: loadingGraphite } =
    useIsGraphiteEnabled();
  const { isFileStoreSupported, loading: loadingFileStoreSupport } =
    useIsFileStoreSupported();

  const isProjectReady = !isPlatform || !!project;

  const { data, loading, error, refetch } = useGetGraphiteFileStoresQuery({
    client: remoteProjectGQLClient,
    skip: !isProjectReady,
  });

  const fileStores = useMemo<GraphiteFileStore[]>(
    () => data?.graphite?.fileStores || [],
    [data],
  );

  const openCreateFileStoreForm = () => {
    openDrawer({
      title: 'Create a new File Store',
      component: <FileStoreForm onSubmit={refetch} />,
    });
  };

  const isPageDataLoading =
    loadingOrg ||
    loadingProject ||
    loadingGraphite ||
    loadingFileStoreSupport ||
    loading;
  const shouldShowLoadingState = isPageDataLoading || !isProjectReady;

  if (shouldShowLoadingState) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner size="medium" wrapperClassName="gap-2">
          Loading File Stores...
        </Spinner>
      </div>
    );
  }

  if (isPlatform && org?.plan?.isFree) {
    return (
      <div className="bg-background p-4">
        <UpgradeToProBanner
          section="ai-file-stores"
          title="Upgrade to Nhost Pro."
          description={
            <p>
              Graphite is an addon to the Pro plan. To unlock it, please upgrade
              to Pro first.
            </p>
          }
        />
      </div>
    );
  }

  const slug = isPlatform ? org?.slug : 'local';
  const aiServiceUnavailable =
    isPlatform && !org?.plan?.isFree && !project?.config?.ai;

  if (aiServiceUnavailable || !isGraphiteEnabled) {
    return (
      <div className="w-full bg-background p-4">
        <Alert className="grid w-full grid-flow-col place-content-between items-center gap-2">
          <p>
            To enable graphite, configure the service first in{' '}
            <Link
              href={`/orgs/${slug}/projects/${project?.subdomain}/settings/ai`}
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              AI Settings
            </Link>
            .
          </p>
        </Alert>
      </div>
    );
  }

  if (error) {
    throw error;
  }

  if (fileStores.length === 0 && !loading) {
    return (
      <div className="w-full bg-background p-6">
        <div className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <FileStoresIcon className="h-10 w-10" />

          <div className="flex flex-col space-y-1">
            <h2 className="text-center font-medium text-lg">
              No File Stores are configured
            </h2>
            <p className="text-center text-muted-foreground text-sm">
              File Stores are used to share storage documents with your AI
              assistants.
            </p>
            {isFileStoreSupported === false && (
              <div className="px-4 pb-4">
                <Alert variant="warning" className="mt-2 text-left">
                  Please upgrade Graphite to its latest version in order to use
                  file stores.
                </Alert>
              </div>
            )}
          </div>
          <div className="flex flex-row place-content-between rounded-lg">
            <Button
              className="w-full"
              onClick={openCreateFileStoreForm}
              size="sm"
              disabled={!isFileStoreSupported}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Add a new File Store
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col overflow-hidden">
      <div className="flex flex-row place-content-end border-b-1 p-4">
        <Button onClick={openCreateFileStoreForm}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New
        </Button>
      </div>
      <div>
        <FileStoresList
          fileStores={fileStores}
          onDelete={() => refetch()}
          onCreateOrUpdate={() => refetch()}
        />
      </div>
    </div>
  );
}

FileStoresPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{
        className:
          'flex flex-row w-full h-full !bg-[#fafafa] dark:!bg-[#151a22]',
      }}
    >
      <AISidebar />
      <div className="w-full overflow-auto">
        <RetryableErrorBoundary>{page}</RetryableErrorBoundary>
      </div>
    </OrgLayout>
  );
};
