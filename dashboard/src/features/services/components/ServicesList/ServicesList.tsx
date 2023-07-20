import { useDialog } from '@/components/common/DialogProvider';
import { Box } from '@/components/ui/v2/Box';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { IconButton } from '@/components/ui/v2/IconButton';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { CubeIcon } from '@/components/ui/v2/icons/CubeIcon';
import { DotsHorizontalIcon } from '@/components/ui/v2/icons/DotsHorizontalIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  ServiceForm,
  type PortTypes,
} from '@/features/services/components/ServiceForm';
import {
  useDeleteRunServiceConfigMutation,
  useDeleteRunServiceMutation,
  useGetRunServicesQuery,
} from '@/utils/__generated__/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { copy } from '@/utils/copy';
import type { ApolloError } from '@apollo/client';
import { formatDistanceToNow } from 'date-fns';
import type { RunService } from 'pages/[workspaceSlug]/[appSlug]/services';
import { toast } from 'react-hot-toast';

interface ServicesListProps {
  /**
   * The run services fetched from entering the users page.
   */
  services: RunService[];
  /**
   * Function to be called after a successful delete action.
   *
   * @example onDelete={() => refetch()}
   */
  onDelete?: () => Promise<any>;
}

export default function ServicesList({
  services,
  onDelete,
}: ServicesListProps) {
  const { openDrawer } = useDialog();
  const [deleteRunService] = useDeleteRunServiceMutation();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [deleteRunServiceConfig] = useDeleteRunServiceConfigMutation();

  const { refetch: refetchServices } = useGetRunServicesQuery({
    variables: {
      appID: currentProject.id,
      resolve: false,
    },
  });

  const deleteServiceAndConfig = async (appID: string, serviceID: string) => {
    await deleteRunService({ variables: { serviceID } });
    await deleteRunServiceConfig({ variables: { appID, serviceID } });
    await onDelete?.();
  };

  const viewService = async (service: RunService) => {
    const {
      image,
      command,
      ports,
      resources: { compute, replicas, storage },
    } = service.config;

    openDrawer({
      title: (
        <Box className="flex flex-row items-center space-x-2">
          <CubeIcon className="w-5 h-5" />
          <Text>Edit {service.config.name}</Text>
        </Box>
      ),
      component: (
        <ServiceForm
          serviceID={service.id}
          initialData={{
            ...service.config,
            image: image.image,
            command: command?.join(' '),
            ports: ports.map((item) => ({
              port: item.port,
              type: item.type as PortTypes,
              publish: item.publish,
            })),
            compute,
            replicas,
            storage,
          }}
          onSubmit={refetchServices}
        />
      ),
    });
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

  return (
    <Box className="flex flex-col">
      {services.map((service) => (
        <Box
          className="flex items-center justify-between w-full px-4 py-2 space-x-4 transition-colors cursor-pointer border-b-1"
          onClick={() => viewService(service)}
          sx={{
            [`&:hover`]: {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <div className="flex flex-row items-center space-x-4">
            <CubeIcon className="w-5 h-5" />
            <div className="flex flex-col">
              <div className="flex flex-row items-center space-x-2">
                <Text className="">{service.id}</Text>
                <IconButton
                  variant="borderless"
                  color="secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    copy(service.id, 'Service Id');
                  }}
                  aria-label="Service Id"
                >
                  <CopyIcon className="w-4 h-4" />
                </IconButton>
              </div>
              <Text>{service.config.name}</Text>
              <Tooltip title={service.updatedAt}>
                <span className="cursor-pointer">
                  Last updated{' '}
                  {formatDistanceToNow(new Date(service.updatedAt))} ago
                </span>
              </Tooltip>
            </div>
          </div>

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
                onClick={() => viewService(service)}
                className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
              >
                <UserIcon className="w-4 h-4" />
                <Text className="font-medium">View Service</Text>
              </Dropdown.Item>

              <Divider component="li" />

              <Dropdown.Item
                className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                sx={{ color: 'error.main' }}
                onClick={() => deleteService(service.id)}
              >
                <TrashIcon className="w-4 h-4" />
                <Text className="font-medium" color="error">
                  Delete Service
                </Text>
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Root>
        </Box>
      ))}
    </Box>
  );
}
