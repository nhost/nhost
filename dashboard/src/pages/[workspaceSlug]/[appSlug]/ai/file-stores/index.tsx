import { useDialog } from '@/components/common/DialogProvider';
import { Pagination } from '@/components/common/Pagination';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import AILayout from '@/components/layout/AILayout/AILayout';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { FileStoresIcon } from '@/components/ui/v2/icons/FileStoresIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { useIsFileStoreSupported } from '@/features/ai/common/hooks/useIsFileStoreSupported';
import { FileStoreForm } from '@/features/ai/FileStoreForm';
import { FileStoresList } from '@/features/ai/FileStoresList';
import { useAdminApolloClient } from '@/features/projects/common/hooks/useAdminApolloClient';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsGraphiteEnabled } from '@/features/projects/common/hooks/useIsGraphiteEnabled';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  useGetGraphiteFileStoresQuery,
  type GetGraphiteFileStoresQuery
} from '@/utils/__generated__/graphite.graphql';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';

export type GraphiteFileStore = Omit<
  GetGraphiteFileStoresQuery['graphite']['fileStores'][0],
  '__typename'
>;

export default function FileStoresPage() {
  const limit = useRef(25);
  const router = useRouter();
  const { openDrawer } = useDialog();

  const isPlatform = useIsPlatform();

  const { currentWorkspace, currentProject } = useCurrentWorkspaceAndProject();

  const { adminClient } = useAdminApolloClient();
  const { isGraphiteEnabled } = useIsGraphiteEnabled();
  const { isFileStoreSupported } = useIsFileStoreSupported();

  const [currentPage, setCurrentPage] = useState(
    parseInt(router.query.page as string, 10) || 1,
  );
  const [nrOfPages, setNrOfPages] = useState(0);
  const offset = useMemo(() => currentPage - 1, [currentPage]);

  const { data, loading, refetch } = useGetGraphiteFileStoresQuery({
    client: adminClient,
    variables: {
      limit: limit.current,
      offset,
    },
  });

  useEffect(() => {
    if (loading) {
      return;
    }

    const fileStoresCount = data?.graphite?.fileStores?.length ?? 0;

    setNrOfPages(Math.ceil(fileStoresCount / limit.current));
  }, [data, loading]);

  const fileStores = useMemo(() => data?.graphite.fileStores || [], [data]);

  const openCreateFileStore = () => {
    openDrawer({
      title: 'Create a new File Store',
      component: <FileStoreForm onSubmit={refetch} />,
    });
  };

  if (isPlatform && currentProject?.plan?.isFree) {
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
    (isPlatform &&
      !currentProject?.plan?.isFree &&
      !currentProject.config?.ai) ||
    !isGraphiteEnabled
  ) {
    return (
      <Box className="p-4" sx={{ backgroundColor: 'background.default' }}>
        <Alert className="grid w-full grid-flow-col place-content-between items-center gap-2">
          <Text className="grid grid-flow-row justify-items-start gap-0.5">
            <Text component="span">
              To enable graphite, configure the service first in{' '}
              <Link
                href={`/${currentWorkspace.slug}/${currentProject.slug}/settings/ai`}
                target="_blank"
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

  if (!loading && fileStores.length === 0) {
    return (
      <Box className="p-6" sx={{ backgroundColor: 'background.default' }}>
        <Box className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <FileStoresIcon className="h-10 w-10" />
          {/* <EmbeddingsIcon className="h-10 w-10" /> */}

          <div className="flex flex-col space-y-1">
            <Text className="text-center font-medium" variant="h3">
              No File Stores are configured
            </Text>
            <Text variant="subtitle1" className="text-center">
                File Stores are used to share your files and documents with your AI assistants.
            </Text>
            {!isFileStoreSupported && (
            <Box className={twMerge('px-4', 'pb-4')}>
              <Alert className="text-left">
                Please upgrade Graphite to its latest version in order to use file stores.
              </Alert>
            </Box>
            )}
          </div>
          <div className="flex flex-row place-content-between rounded-lg ">
            <Button
              variant="contained"
              color="primary"
              className="w-full"
              onClick={openCreateFileStore}
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
    <Box className="flex flex-col overflow-hidden">
      <Box className="flex flex-row place-content-end border-b-1 p-4">
        <Button
          variant="contained"
          color="primary"
          onClick={openCreateFileStore}
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

        <Pagination
          className="px-2 py-4"
          totalNrOfPages={nrOfPages}
          currentPageNumber={currentPage}
          totalNrOfElements={data?.graphite.fileStores?.length ?? 0}
          itemsLabel="File Stores"
          elementsPerPage={limit.current}
          onPrevPageClick={async () => {
            setCurrentPage((page) => page - 1);
            if (currentPage - 1 !== 1) {
              await router.push({
                pathname: router.pathname,
                query: { ...router.query, page: currentPage - 1 },
              });
            }
          }}
          onNextPageClick={async () => {
            setCurrentPage((page) => page + 1);
            await router.push({
              pathname: router.pathname,
              query: { ...router.query, page: currentPage + 1 },
            });
          }}
          onPageChange={async (page) => {
            setCurrentPage(page);
            await router.push({
              pathname: router.pathname,
              query: { ...router.query, page },
            });
          }}
        />
      </div>
    </Box>
  );
}

FileStoresPage.getLayout = function getLayout(page: ReactElement) {
  return <AILayout>{page}</AILayout>;
};
