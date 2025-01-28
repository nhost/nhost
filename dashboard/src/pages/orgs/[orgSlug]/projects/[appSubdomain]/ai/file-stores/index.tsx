import { useDialog } from '@/components/common/DialogProvider';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { FileStoresIcon } from '@/components/ui/v2/icons/FileStoresIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { FileStoreForm } from '@/features/orgs/projects/ai/FileStoreForm';
import { FileStoresList } from '@/features/orgs/projects/ai/FileStoresList';
import { useIsFileStoreSupported } from '@/features/orgs/projects/common/hooks/useIsFileStoreSupported';
import { useIsGraphiteEnabled } from '@/features/orgs/projects/common/hooks/useIsGraphiteEnabled';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAdminApolloClient } from '@/features/orgs/projects/hooks/useAdminApolloClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetGraphiteFileStoresQuery,
  type GetGraphiteFileStoresQuery,
} from '@/utils/__generated__/graphite.graphql';
import { useMemo, type ReactElement } from 'react';

import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { AISidebar } from '@/features/orgs/layout/AISidebar';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export type GraphiteFileStore = Omit<
  GetGraphiteFileStoresQuery['graphite']['fileStores'][0],
  '__typename'
>;

export default function FileStoresPage() {
  const { openDrawer } = useDialog();
  const isPlatform = useIsPlatform();

  const { org, loading: loadingOrg } = useCurrentOrg();
  const { project, loading: loadingProject } = useProject();

  const { adminClient } = useAdminApolloClient();
  const { isGraphiteEnabled } = useIsGraphiteEnabled();
  const { isFileStoreSupported } = useIsFileStoreSupported();

  const { data, loading, refetch } = useGetGraphiteFileStoresQuery({
    client: adminClient,
  });

  const fileStores = useMemo(() => data?.graphite.fileStores || [], [data]);

  const openCreateFileStoreForm = () => {
    openDrawer({
      title: 'Create a new File Store',
      component: <FileStoreForm onSubmit={refetch} />,
    });
  };

  if (loadingOrg || loadingProject || loading) {
    return (
      <Box className="flex h-full w-full items-center justify-center">
        <ActivityIndicator
          delay={1000}
          label="Loading File Stores..."
          className="justify-center"
        />
      </Box>
    );
  }

  if (isPlatform && org?.plan?.isFree) {
    return (
      <Box className="p-4" sx={{ backgroundColor: 'background.default' }}>
        <UpgradeToProBanner
          title="Upgrade to Nhost Pro."
          description={
            <Text>
              Graphite is an addon to the Pro plan. To unlock it, please upgrade
              to Pro first.
            </Text>
          }
        />
      </Box>
    );
  }

  if (
    (isPlatform && !org?.plan?.isFree && !project.config?.ai) ||
    !isGraphiteEnabled
  ) {
    return (
      <Box
        className="w-full p-4"
        sx={{ backgroundColor: 'background.default' }}
      >
        <Alert className="grid w-full grid-flow-col place-content-between items-center gap-2">
          <Text className="grid grid-flow-row justify-items-start gap-0.5">
            <Text component="span">
              To enable graphite, configure the service first in{' '}
              <Link
                href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/ai`}
                rel="noopener noreferrer"
                underline="hover"
              >
                AI Settings
              </Link>
              .
            </Text>
          </Text>
        </Alert>
      </Box>
    );
  }

  if (fileStores.length === 0 && !loading) {
    return (
      <Box
        className="w-full p-6"
        sx={{ backgroundColor: 'background.default' }}
      >
        <Box className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <FileStoresIcon className="h-10 w-10" />

          <div className="flex flex-col space-y-1">
            <Text className="text-center font-medium" variant="h3">
              No File Stores are configured
            </Text>
            <Text variant="subtitle1" className="text-center">
              File Stores are used to share storage documents with your AI
              assistants.
            </Text>
            {!isFileStoreSupported && (
              <Box className="px-4 pb-4">
                <Alert className="mt-2 text-left">
                  Please upgrade Graphite to its latest version in order to use
                  file stores.
                </Alert>
              </Box>
            )}
          </div>
          <div className="flex flex-row place-content-between rounded-lg">
            <Button
              variant="contained"
              color="primary"
              className="w-full"
              onClick={openCreateFileStoreForm}
              startIcon={<PlusIcon className="h-4 w-4" />}
              disabled={!isFileStoreSupported}
            >
              Add a new File Store
            </Button>
          </div>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="flex w-full flex-col overflow-hidden">
      <Box className="flex flex-row place-content-end border-b-1 p-4">
        <Button
          variant="contained"
          color="primary"
          onClick={openCreateFileStoreForm}
          startIcon={<PlusIcon className="h-4 w-4" />}
        >
          New
        </Button>
      </Box>
      <div>
        <FileStoresList
          fileStores={fileStores}
          onDelete={() => refetch()}
          onCreateOrUpdate={() => refetch()}
        />
      </div>
    </Box>
  );
}

FileStoresPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{ className: 'flex flex-row w-full h-full' }}
    >
      <AISidebar className="w-full max-w-sidebar" />
      <RetryableErrorBoundary>{page}</RetryableErrorBoundary>
    </ProjectLayout>
  );
};
