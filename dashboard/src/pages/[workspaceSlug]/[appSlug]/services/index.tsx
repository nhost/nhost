import { useDialog } from '@/components/common/DialogProvider';
import { Pagination } from '@/components/common/Pagination';
import { Container } from '@/components/layout/Container';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { CubeIcon } from '@/components/ui/v2/icons/CubeIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { ServicesIcon } from '@/components/ui/v2/icons/ServicesIcon';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import type { GetRunServicesQuery } from '@/utils/__generated__/graphql';
import { useGetRunServicesQuery } from '@/utils/__generated__/graphql';

import { UpgradeNotification } from '@/features/projects/common/components/UpgradeNotification';
import {
  ServiceForm,
  type PortTypes,
} from '@/features/services/components/ServiceForm';
import ServicesList from '@/features/services/components/ServicesList/ServicesList';
import { useRouter } from 'next/router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';

export type RunService = Omit<
  GetRunServicesQuery['app']['runServices'][0],
  '__typename'
>;

export type RunServiceConfig = Omit<
  GetRunServicesQuery['app']['runServices'][0]['config'],
  '__typename'
>;

export default function ServicesPage() {
  const limit = useRef(25);
  const router = useRouter();
  const { openDrawer, openAlertDialog } = useDialog();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const isPlanFree = currentProject.plan.isFree;

  const [currentPage, setCurrentPage] = useState(
    parseInt(router.query.page as string, 10) || 1,
  );

  const [nrOfPages, setNrOfPages] = useState(0);

  const offset = useMemo(() => currentPage - 1, [currentPage]);

  const {
    data,
    loading,
    refetch: refetchServices,
  } = useGetRunServicesQuery({
    variables: {
      appID: currentProject.id,
      resolve: false,
      limit: limit.current,
      offset,
    },
  });

  useEffect(() => {
    if (loading) {
      return;
    }

    const userCount = data?.app?.runServices_aggregate.aggregate.count ?? 0;

    setNrOfPages(Math.ceil(userCount / limit.current));
  }, [data, loading]);

  const services = useMemo(
    () => data?.app?.runServices.map((service) => service) ?? [],
    [data],
  );

  const checkConfigFromQuery = useCallback(
    (base64Config: string) => {
      if (router.query?.config) {
        try {
          const decodedConfig = atob(base64Config);
          const parsedConfig: RunServiceConfig = JSON.parse(decodedConfig);

          openDrawer({
            title: (
              <Box className="flex flex-row items-center space-x-2">
                <CubeIcon className="h-5 w-5" />
                <Text>Create a new run service</Text>
              </Box>
            ),
            component: (
              <ServiceForm
                initialData={{
                  ...parsedConfig,
                  compute: parsedConfig?.resources?.compute ?? {
                    cpu: 62,
                    memory: 128,
                  },
                  image: parsedConfig?.image?.image,
                  command: parsedConfig?.command?.join(' '),
                  ports: parsedConfig?.ports.map((item) => ({
                    port: item.port,
                    type: item.type as PortTypes,
                    publish: item.publish,
                  })),
                  replicas: parsedConfig?.resources?.replicas,
                  storage: parsedConfig?.resources?.storage,
                }}
                onSubmit={refetchServices}
              />
            ),
          });
        } catch (error) {
          openAlertDialog({
            title: 'Configuration not set properly',
            payload: 'The service configuration was not properly encoded',
            props: {
              primaryButtonText: 'Ok',
              hideSecondaryAction: true,
            },
          });
        }
      }
    },
    [router.query.config, openDrawer, refetchServices, openAlertDialog],
  );

  useEffect(() => {
    if (router.query?.config) {
      checkConfigFromQuery(router.query?.config as string);
    }
  }, [checkConfigFromQuery, router.query]);

  const openCreateServiceDialog = () => {
    openDrawer({
      title: (
        <Box className="flex flex-row items-center space-x-2">
          <CubeIcon className="h-5 w-5" />
          <Text>Create a new service</Text>
        </Box>
      ),
      component: <ServiceForm onSubmit={refetchServices} />,
    });
  };

  if (isPlanFree) {
    return (
      <Container>
        <UpgradeNotification
          message="Unlock Nhost Run by upgrading your project to the Pro plan."
          className="mt-4"
        />
      </Container>
    );
  }

  if (data?.app.runServices.length === 0 && !loading) {
    return (
      <Container className="mx-auto max-w-9xl space-y-5 overflow-x-hidden">
        <div className="flex flex-row place-content-end">
          <Button
            variant="contained"
            color="primary"
            onClick={openCreateServiceDialog}
            startIcon={<PlusIcon className="h-4 w-4" />}
          >
            Add service
          </Button>
        </div>

        <Box className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <ServicesIcon className="h-10 w-10" />
          <div className="flex flex-col space-y-1">
            <Text className="text-center font-medium" variant="h3">
              No custom services are available
            </Text>
            <Text variant="subtitle1" className="text-center">
              All your project’s custom services will be listed here.
            </Text>
          </div>
          <div className="flex flex-row place-content-between rounded-lg ">
            <Button
              variant="contained"
              color="primary"
              className="w-full"
              onClick={openCreateServiceDialog}
              startIcon={<PlusIcon className="h-4 w-4" />}
            >
              Add service
            </Button>
          </div>
        </Box>
      </Container>
    );
  }

  return (
    <div className="flex flex-col">
      <Box className="flex flex-row place-content-end border-b-1 p-4">
        <Button
          variant="contained"
          color="primary"
          onClick={openCreateServiceDialog}
          startIcon={<PlusIcon className="h-4 w-4" />}
        >
          Add service
        </Button>
      </Box>
      <Box className="space-y-4">
        <ServicesList
          services={services}
          onDelete={() => refetchServices()}
          onCreateOrUpdate={() => refetchServices()}
        />
        <Pagination
          className="px-2"
          totalNrOfPages={nrOfPages}
          currentPageNumber={currentPage}
          totalNrOfElements={
            data?.app?.runServices_aggregate.aggregate.count ?? 0
          }
          itemsLabel="services"
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
      </Box>
    </div>
  );
}

ServicesPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
