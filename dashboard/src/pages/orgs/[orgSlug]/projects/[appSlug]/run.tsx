import { useDialog } from '@/components/common/DialogProvider';
import { Pagination } from '@/components/common/Pagination';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { CubeIcon } from '@/components/ui/v2/icons/CubeIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { ServicesIcon } from '@/components/ui/v2/icons/ServicesIcon';
import { Text } from '@/components/ui/v2/Text';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import {
  useRunServices,
  type RunServiceConfig,
} from '@/features/orgs/projects/common/hooks/useRunServices';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ServiceForm } from '@/features/orgs/projects/services/components/ServiceForm';
import { type PortTypes } from '@/features/orgs/projects/services/components/ServiceForm/components/PortsFormSection/PortsFormSectionTypes';
import ServicesList from '@/features/orgs/projects/services/components/ServicesList/ServicesList';
import { useRouter } from 'next/router';
import { useCallback, useEffect, type ReactElement } from 'react';

export default function RunPage() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { openDrawer, openAlertDialog } = useDialog();
  const { org } = useCurrentOrg();
  const { loading: loadingProject } = useProject();

  const {
    loading,
    services,
    totalServicesCount,
    limit,
    nrOfPages,
    currentPage,
    setCurrentPage,
    refetch,
  } = useRunServices();

  const isPlanFree = org?.plan?.isFree;

  const checkConfigFromQuery = useCallback(
    (base64Config: string) => {
      if (router.query?.config) {
        try {
          const decodedConfig = atob(base64Config);
          const parsedConfig: RunServiceConfig = JSON.parse(decodedConfig);

          openDrawer({
            title: (
              <Box className="flex flex-row items-center space-x-2">
                <CubeIcon className="w-5 h-5" />
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
                onSubmit={refetch}
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
    [router.query.config, openDrawer, refetch, openAlertDialog],
  );

  useEffect(() => {
    if (router.query?.config) {
      checkConfigFromQuery(router.query?.config as string);
    }
  }, [checkConfigFromQuery, router.query]);

  const openCreateServiceDialog = () => {
    // creating services using the local dashboard is not supported
    if (!isPlatform) {
      return;
    }

    openDrawer({
      title: (
        <Box className="flex flex-row items-center space-x-2">
          <CubeIcon className="w-5 h-5" />
          <Text>Create a new service</Text>
        </Box>
      ),
      component: <ServiceForm onSubmit={refetch} />,
    });
  };

  if (isPlatform && isPlanFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeToProBanner
          title="To unlock Nhost Run, transfer this project to a Pro or Team organization."
          description=""
        />
      </Container>
    );
  }

  if (loading && loadingProject) {
    return (
      <Container>
        <ActivityIndicator />
      </Container>
    );
  }

  if (services.length === 0 && !loading) {
    return (
      <Container className="mx-auto space-y-5 overflow-x-hidden max-w-9xl">
        <div className="flex flex-row place-content-end">
          <Button
            variant="contained"
            color="primary"
            onClick={openCreateServiceDialog}
            startIcon={<PlusIcon className="w-4 h-4" />}
            disabled={!isPlatform}
          >
            Add service
          </Button>
        </div>

        <Box className="flex flex-col items-center justify-center px-48 py-12 space-y-5 border rounded-lg shadow-sm">
          <ServicesIcon className="w-10 h-10" />
          <div className="flex flex-col space-y-1">
            <Text className="font-medium text-center" variant="h3">
              No custom services are available
            </Text>
            <Text variant="subtitle1" className="text-center">
              All your project&apos;s custom services will be listed here.
            </Text>
          </div>
          {isPlatform ? (
            <div className="flex flex-row rounded-lg place-content-between">
              <Button
                variant="contained"
                color="primary"
                className="w-full"
                onClick={openCreateServiceDialog}
                startIcon={<PlusIcon className="w-4 h-4" />}
              >
                Add service
              </Button>
            </div>
          ) : null}
        </Box>
      </Container>
    );
  }

  return (
    <div className="flex flex-col">
      <Box className="flex flex-row p-4 place-content-end border-b-1">
        <Button
          variant="contained"
          color="primary"
          onClick={openCreateServiceDialog}
          startIcon={<PlusIcon className="w-4 h-4" />}
          disabled={!isPlatform}
        >
          Add service
        </Button>
      </Box>
      <Box className="space-y-4">
        <ServicesList
          services={services}
          onDelete={() => refetch()}
          onCreateOrUpdate={() => refetch()}
        />
        {isPlatform ? (
          <Pagination
            className="px-2"
            totalNrOfPages={nrOfPages}
            currentPageNumber={currentPage}
            totalNrOfElements={totalServicesCount}
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
        ) : null}
      </Box>
    </div>
  );
}

RunPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
