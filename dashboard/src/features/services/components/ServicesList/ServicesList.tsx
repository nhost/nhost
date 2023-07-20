import { useDialog } from '@/components/common/DialogProvider';
import { Box } from '@/components/ui/v2/Box';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { IconButton } from '@/components/ui/v2/IconButton';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { CubeIcon } from '@/components/ui/v2/icons/CubeIcon';
import { DotsHorizontalIcon } from '@/components/ui/v2/icons/DotsHorizontalIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  ServiceForm,
  type PortTypes,
} from '@/features/services/components/ServiceForm';
import { getToastStyleProps } from '@/utils/constants/settings';
import { copy } from '@/utils/copy';
import {
  useDeleteRunServiceConfigMutation,
  useDeleteRunServiceMutation,
} from '@/utils/__generated__/graphql';
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
   * Function to be called after a submitting the form for either creating or updating a service.
   *
   * @example onDelete={() => refetch()}
   */
  onCreateOrUpdate?: () => Promise<any>;

  /**
   * Function to be called after a successful delete action.
   *
   */
  onDelete?: () => Promise<any>;
}

export default function ServicesList({
  services,
  onCreateOrUpdate,
  onDelete,
}: ServicesListProps) {
  const { openDrawer } = useDialog();
  const [deleteRunService] = useDeleteRunServiceMutation();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [deleteRunServiceConfig] = useDeleteRunServiceConfigMutation();

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
          <CubeIcon className="h-5 w-5" />
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
          onSubmit={() => onCreateOrUpdate()}
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
          key={service.id}
          className="flex h-[64px] w-full cursor-pointer items-center justify-between space-x-4 border-b-1 px-4 py-2 transition-colors"
          sx={{
            [`&:hover`]: {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <Box
            onClick={() => viewService(service)}
            className="flex w-full flex-row justify-between"
            sx={{
              backgroundColor: 'transparent',
            }}
          >
            <div className="flex flex-1 flex-row items-center space-x-4">
              <CubeIcon className="h-5 w-5" />
              <div className="flex flex-col">
                <Text variant="h4" className="font-semibold">
                  {service.config.name}
                </Text>
                <Tooltip title={service.updatedAt}>
                  <span className="hidden cursor-pointer text-sm text-slate-500 xs+:flex">
                    Deployed {formatDistanceToNow(new Date(service.updatedAt))}{' '}
                    ago
                  </span>
                </Tooltip>
              </div>
            </div>

            <div className="hidden flex-row items-center space-x-2 md:flex">
              <Text variant="subtitle1" className="font-mono text-xs">
                {service.id}
              </Text>
              <IconButton
                variant="borderless"
                color="secondary"
                onClick={(event) => {
                  copy(service.id, 'Service Id');
                  event.stopPropagation();
                }}
                aria-label="Service Id"
              >
                <CopyIcon className="h-4 w-4" />
              </IconButton>
            </div>
          </Box>

          <Dropdown.Root>
            <Dropdown.Trigger
              asChild
              hideChevron
              onClick={(event) => event.stopPropagation()}
            >
              <IconButton
                variant="borderless"
                color="secondary"
                aria-label="More options"
                onClick={(event) => event.stopPropagation()}
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
                className="z-50 grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
              >
                <UserIcon className="h-4 w-4" />
                <Text className="font-medium">View Service</Text>
              </Dropdown.Item>
              <Divider component="li" />
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
      ))}
    </Box>
  );
}
