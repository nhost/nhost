import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { type ReactElement, useMemo } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { Pagination } from '@/components/common/Pagination';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Alert } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { EmbeddingsIcon } from '@/components/ui/v3/icons/EmbeddingsIcon';
import { Spinner } from '@/components/ui/v3/spinner';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { AISidebar } from '@/features/orgs/layout/AISidebar';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { AutoEmbeddingsForm } from '@/features/orgs/projects/ai/AutoEmbeddingsForm';
import { AutoEmbeddingsList } from '@/features/orgs/projects/ai/AutoEmbeddingsList';
import type { AutoEmbeddingsConfiguration } from '@/features/orgs/projects/ai/auto-embeddings/types';
import { useIsGraphiteEnabled } from '@/features/orgs/projects/common/hooks/useIsGraphiteEnabled';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import {
  getPageNumberFromQuery,
  useUrlPagination,
} from '@/features/orgs/projects/common/hooks/useUrlPagination';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetGraphiteAutoEmbeddingsConfigurationsQuery } from '@/generated/graphite';
import { getPaginationOffset } from '@/utils/getPaginationOffset';

const ELEMENTS_PER_PAGE = 25;

export default function AutoEmbeddingsPage() {
  const router = useRouter();

  const { openDrawer } = useDialog();
  const isPlatform = useIsPlatform();

  const { org, loading: loadingOrg } = useCurrentOrg();
  const { project, loading: loadingProject } = useProject();

  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const { isGraphiteEnabled, loading: loadingGraphite } =
    useIsGraphiteEnabled();

  const isProjectReady = !isPlatform || !!project;

  const currentPage = getPageNumberFromQuery(router.query.page);
  const offset = useMemo(
    () => getPaginationOffset(currentPage, ELEMENTS_PER_PAGE),
    [currentPage],
  );

  const { data, loading, error, refetch } =
    useGetGraphiteAutoEmbeddingsConfigurationsQuery({
      client: remoteProjectGQLClient,
      variables: {
        limit: ELEMENTS_PER_PAGE,
        offset,
      },
      skip: !isProjectReady,
    });

  const totalNrOfElements =
    data?.graphiteAutoEmbeddingsConfigurationAggregate?.aggregate?.count ?? 0;

  const { nrOfPages, goToPage, goToNextPage, goToPreviousPage } =
    useUrlPagination({
      currentPage,
      elementsPerPage: ELEMENTS_PER_PAGE,
      totalNrOfElements,
      loading: loading || !isProjectReady,
    });

  const autoEmbeddingsConfigurations = useMemo<AutoEmbeddingsConfiguration[]>(
    () => data?.graphiteAutoEmbeddingsConfigurations || [],
    [data],
  );

  const openCreateAutoEmbeddingsConfiguration = () => {
    openDrawer({
      title: (
        <div className="flex flex-row items-center space-x-2">
          <span>Create new Auto-Embeddings configuration</span>
        </div>
      ),
      component: <AutoEmbeddingsForm onSubmit={refetch} />,
    });
  };

  const isPageDataLoading =
    loadingOrg || loadingProject || loadingGraphite || loading;
  const shouldShowLoadingState = isPageDataLoading || !isProjectReady;

  if (shouldShowLoadingState) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner size="medium" wrapperClassName="gap-2">
          Loading Auto-Embeddings...
        </Spinner>
      </div>
    );
  }

  if (isPlatform && org?.plan?.isFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeToProBanner
          section="ai-auto-embeddings"
          title="To unlock Auto-Embeddings, transfer this project to a Pro or Team organization."
          description=""
        />
      </Container>
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

  if (autoEmbeddingsConfigurations.length === 0 && !loading) {
    return (
      <div className="w-full bg-background p-6">
        <div className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <EmbeddingsIcon className="h-10 w-10" />
          <div className="flex flex-col space-y-1">
            <h2 className="text-center font-medium text-lg">
              No Auto-Embeddings are configured
            </h2>
            <p className="text-center text-muted-foreground text-sm">
              All your configurations will be listed here.
            </p>
          </div>
          <div className="flex flex-row place-content-between rounded-lg">
            <Button
              className="w-full"
              onClick={openCreateAutoEmbeddingsConfiguration}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Add a new Auto-Embeddings Configuration
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col overflow-hidden">
      <div className="flex flex-row place-content-end border-b-1 p-4">
        <Button onClick={openCreateAutoEmbeddingsConfiguration}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New
        </Button>
      </div>
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
          totalNrOfElements={totalNrOfElements}
          itemsLabel="Auto-Embeddings Configurations"
          elementsPerPage={ELEMENTS_PER_PAGE}
          onPrevPageClick={goToPreviousPage}
          onNextPageClick={goToNextPage}
          onPageChange={goToPage}
        />
      </div>
    </div>
  );
}

AutoEmbeddingsPage.getLayout = function getLayout(page: ReactElement) {
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
