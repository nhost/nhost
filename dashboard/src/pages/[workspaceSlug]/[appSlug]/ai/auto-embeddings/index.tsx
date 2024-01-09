import { useDialog } from '@/components/common/DialogProvider';
import { Pagination } from '@/components/common/Pagination';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import AILayout from '@/components/layout/AILayout/AILayout';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { EmbeddingsIcon } from '@/components/ui/v2/icons/EmbeddingsIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { AutoEmbeddingsForm } from '@/features/ai/AutoEmbeddingsForm';
import { AutoEmbeddingsList } from '@/features/ai/AutoEmbeddingsList';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { getHasuraAdminSecret } from '@/utils/env';
import {
  useGetGraphiteAutoEmbeddingsConfigurationsQuery,
  type GetGraphiteAutoEmbeddingsConfigurationsQuery,
} from '@/utils/__generated__/graphite.graphql';
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
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

  const { currentWorkspace, currentProject } = useCurrentWorkspaceAndProject();
  const adminSecret = currentProject?.config?.hasura?.adminSecret;

  const serviceUrl = generateAppServiceUrl(
    currentProject?.subdomain,
    currentProject?.region,
    'graphql',
  );

  const client = useMemo(
    () =>
      new ApolloClient({
        cache: new InMemoryCache(),
        link: new HttpLink({
          uri: serviceUrl,
          headers: {
            'x-hasura-admin-secret':
              process.env.NEXT_PUBLIC_ENV === 'dev'
                ? getHasuraAdminSecret()
                : adminSecret,
          },
        }),
      }),
    [serviceUrl, adminSecret],
  );

  const [currentPage, setCurrentPage] = useState(
    parseInt(router.query.page as string, 10) || 1,
  );

  const [nrOfPages, setNrOfPages] = useState(0);

  const offset = useMemo(() => currentPage - 1, [currentPage]);

  const { data, loading, refetch } =
    useGetGraphiteAutoEmbeddingsConfigurationsQuery({
      client,
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

  if (currentProject.plan.isFree) {
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

  if (!currentProject.plan.isFree && !currentProject.config?.ai) {
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

  if (data?.graphiteAutoEmbeddingsConfigurations.length === 0 && !loading) {
    return (
      <Box className="p-6" sx={{ backgroundColor: 'background.default' }}>
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
          <div className="flex flex-row place-content-between rounded-lg ">
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
    <Box className="flex flex-col overflow-hidden">
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
  return <AILayout>{page}</AILayout>;
};
