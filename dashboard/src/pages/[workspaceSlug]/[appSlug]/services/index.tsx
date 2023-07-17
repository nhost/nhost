import { useDialog } from '@/components/common/DialogProvider';
import { Container } from '@/components/layout/Container';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { CubeIcon } from '@/components/ui/v2/icons/CubeIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { ServicesIcon } from '@/components/ui/v2/icons/ServicesIcon';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { CreateServiceForm } from '@/features/services/components/CreateServiceForm';
import type { GetRunServicesQuery } from '@/utils/__generated__/graphql';
import { useGetRunServicesQuery } from '@/utils/__generated__/graphql';

import ServicesList from '@/features/services/components/ServicesList/ServicesList';
import { useMemo, type ReactElement } from 'react';

export type RunService = Omit<
  GetRunServicesQuery['app']['runServices'][0],
  '__typename'
>;

export default function ServicesPage() {
  const { openDrawer } = useDialog();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const {
    data,
    loading,
    refetch: refetchServices,
  } = useGetRunServicesQuery({
    variables: {
      appID: currentProject.id,
      resolve: false,
    },
  });

  const services = useMemo(
    () => data?.app?.runServices.map((service) => service) ?? [],
    [data],
  );

  const openCreateServiceDialog = () => {
    openDrawer({
      title: (
        <Box className="flex flex-row items-center space-x-2">
          <CubeIcon className="h-5 w-5" />
          <Text>Create a new service</Text>
        </Box>
      ),
      component: <CreateServiceForm onSubmit={refetchServices} />,
    });
  };

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
    <div>
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
      <ServicesList services={services} onDelete={() => refetchServices()} />
    </div>
  );
}

ServicesPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
