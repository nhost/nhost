/* eslint-disable import/extensions */
import { useDialog } from '@/components/common/DialogProvider';
import { Pagination } from '@/components/common/Pagination';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { EmbeddingsIcon } from '@/components/ui/v2/icons/EmbeddingsIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { AISidebar } from '@/features/orgs/layout/AISidebar';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { AutoEmbeddingsForm } from '@/features/orgs/projects/ai/AutoEmbeddingsForm';
import { AutoEmbeddingsList } from '@/features/orgs/projects/ai/AutoEmbeddingsList';
import { useIsGraphiteEnabled } from '@/features/orgs/projects/common/hooks/useIsGraphiteEnabled';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAdminApolloClient } from '@/features/orgs/projects/hooks/useAdminApolloClient';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetGraphiteAutoEmbeddingsConfigurationsQuery,
  type GetGraphiteAutoEmbeddingsConfigurationsQuery,
} from '@/utils/__generated__/graphite.graphql';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';

export type AutoEmbeddingsConfiguration = Omit<
  GetGraphiteAutoEmbeddingsConfigurationsQuery['graphiteAutoEmbeddingsConfigurations'][0],
  '__typename'
>;

export default function AutoEmbeddingsPage() {
  const limit = useRef(25);
  const router = useRouter();

  const { openDrawer } = useDialog();
  const isPlatform = useIsPlatform();

  const { org } = useCurrentOrg();
  const { project } = useProject();

  const { adminClient } = useAdminApolloClient();
  const { isGraphiteEnabled } = useIsGraphiteEnabled();

  const [currentPage, setCurrentPage] = useState(
    parseInt(router.query.page as string, 10) || 1,
  );
  const [nrOfPages, setNrOfPages] = useState(0);
  const offset = useMemo(() => currentPage - 1, [currentPage]);

  const { data, loading, refetch } =
    useGetGraphiteAutoEmbeddingsConfigurationsQuery({
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

    const autoEmbeddingsCount =
      data?.graphiteAutoEmbeddingsConfigurationAggregate?.aggregate.count ?? 0;

    setNrOfPages(Math.ceil(autoEmbeddingsCount / limit.current));
  }, [data, loading]);

  const autoEmbeddingsConfigurations = useMemo(
    () => data?.graphiteAutoEmbeddingsConfigurations || [],
    [data],
  );

  const openCreateAutoEmbeddingsConfiguration = () => {
    openDrawer({
      title: (
        <Box className="flex flex-row items-center space-x-2">
          <Text>Create new Auto-Embeddings configuration</Text>
        </Box>
      ),
      component: <AutoEmbeddingsForm onSubmit={refetch} />,
    });
  };

  if (isPlatform && org?.plan?.isFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeToProBanner
          title="To unlock Auto-Embeddings, transfer this project to a Pro or Team organization."
          description=""
        />
      </Container>
    );
  }

  if (
    (isPlatform && !org?.plan?.isFree && !project?.config?.ai) ||
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

  if (autoEmbeddingsConfigurations.length === 0 && !loading) {
    return (
      <Box
        className="w-full p-6"
        sx={{ backgroundColor: 'background.default' }}
      >
        <Box className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <EmbeddingsIcon className="h-10 w-10" />
          <div className="flex flex-col space-y-1">
            <Text className="text-center font-medium" variant="h3">
              No Auto-Embeddings are configured
            </Text>
            <Text variant="subtitle1" className="text-center">
              All your configurations will be listed here.
            </Text>
          </div>
          <div className="flex flex-row place-content-between rounded-lg">
            <Button
              variant="contained"
              color="primary"
              className="w-full"
              onClick={openCreateAutoEmbeddingsConfiguration}
              startIcon={<PlusIcon className="h-4 w-4" />}
            >
              Add a new Auto-Embeddings Configuration
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
          onClick={openCreateAutoEmbeddingsConfiguration}
          startIcon={<PlusIcon className="h-4 w-4" />}
        >
          New
        </Button>
      </Box>
      <div>
        <AutoEmbeddingsList
          autoEmbeddingsConfigurations={autoEmbeddingsConfigurations}
          onDelete={() => refetch()}
          onCreateOrUpdate={() => refetch()}
        />

        <Pagination
          className="px-2 py-4"
          totalNrOfPages={nrOfPages}
          currentPageNumber={currentPage}
          totalNrOfElements={
            data?.graphiteAutoEmbeddingsConfigurationAggregate?.aggregate
              ?.count ?? 0
          }
          itemsLabel="Auto-Embeddings Configurations"
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

AutoEmbeddingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{ className: 'flex flex-row w-full h-full' }}
    >
      <AISidebar className="w-full max-w-sidebar" />
      <RetryableErrorBoundary>{page}</RetryableErrorBoundary>
    </ProjectLayout>
  );
};
