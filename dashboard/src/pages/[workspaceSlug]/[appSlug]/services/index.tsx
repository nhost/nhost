import { useDialog } from '@/components/common/DialogProvider';
import { Container } from '@/components/layout/Container';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Chip } from '@/components/ui/v2/Chip';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { IconButton } from '@/components/ui/v2/IconButton';
import { CubeIcon } from '@/components/ui/v2/icons/CubeIcon';
import { DotsHorizontalIcon } from '@/components/ui/v2/icons/DotsHorizontalIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { ServicesIcon } from '@/components/ui/v2/icons/ServicesIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { CreateServiceForm } from '@/features/services/components/CreateServiceForm';
import { getToastStyleProps } from '@/utils/constants/settings';
import {
  useDeleteRunServiceConfigMutation,
  useDeleteRunServiceMutation,
  useGetRunServicesQuery,
} from '@/utils/__generated__/graphql';
import type { ApolloError } from '@apollo/client';

import type { ReactElement } from 'react';
import { toast } from 'react-hot-toast';

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

  const [deleteRunService] = useDeleteRunServiceMutation();
  const [deleteRunServiceConfig] = useDeleteRunServiceConfigMutation();

  const deleteServiceAndConfig = async (appID: string, serviceID: string) => {
    await deleteRunService({ variables: { serviceID } });
    await deleteRunServiceConfig({ variables: { appID, serviceID } });
    await refetchServices();
  };

  const deleteService = async (serviceID: string) => {
    await toast.promise(
      deleteServiceAndConfig(currentProject.id, serviceID),
      {
        loading: 'Deleteing the service...',
        success: `The service has been deleted successfully.`,
        error: (arg: ApolloError) => {
          // we need to get the internal error message from the GraphQL error
          const { internal } = arg.graphQLErrors[0]?.extensions || {};
          const { message } = (internal as Record<string, any>)?.error || {};

          // we use the default Apollo error message if we can't find the
          // internal error message
          return (
            message ||
            arg.message ||
            'An error occurred while deleting the service. Please try again.'
          );
        },
      },
      getToastStyleProps(),
    );
  };

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
      <Box className="">
        {data?.app.runServices.map((service) => (
          <Box
            key={service.id}
            className="flex w-full flex-row items-center justify-between border-b-1 bg-white p-4"
          >
            <Box>
              <Text className="font-semibold">{service.config.name}</Text>
              <Text
                sx={{
                  color: 'grey.600',
                }}
              >
                Deployed 2 hours ago
              </Text>
            </Box>

            <Box className="flex flex-row space-x-4">
              <Chip size="small" label="Live" color="success" />
              <Text>a5f937b</Text>
              <Dropdown.Root>
                <Dropdown.Trigger asChild hideChevron>
                  <IconButton
                    variant="borderless"
                    color="secondary"
                    aria-label="More options"
                  >
                    <DotsHorizontalIcon />
                  </IconButton>
                </Dropdown.Trigger>

                <Dropdown.Content
                  menu
                  PaperProps={{ className: 'w-52' }}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  <Dropdown.Item
                    className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                    sx={{ color: 'error.main' }}
                    onClick={() => deleteService(service.id)}
                  >
                    <TrashIcon className="h-4 w-4" />
                    <Text className="font-medium" color="error">
                      Delete Service
                    </Text>
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Root>
            </Box>
          </Box>
        ))}
      </Box>
    </div>
  );
}

ServicesPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
