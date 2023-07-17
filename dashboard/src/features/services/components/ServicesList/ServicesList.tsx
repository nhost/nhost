import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { IconButton } from '@/components/ui/v2/IconButton';
import { CubeIcon } from '@/components/ui/v2/icons/CubeIcon';
import { DotsHorizontalIcon } from '@/components/ui/v2/icons/DotsHorizontalIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { getToastStyleProps } from '@/utils/constants/settings';
import {
  useDeleteRunServiceConfigMutation,
  useDeleteRunServiceMutation,
} from '@/utils/__generated__/graphql';
import type { ApolloError } from '@apollo/client';
import { useRouter } from 'next/router';
import type { RunService } from 'pages/[workspaceSlug]/[appSlug]/services';
import { Fragment } from 'react';
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
  const router = useRouter();
  const [deleteRunService] = useDeleteRunServiceMutation();
  const { currentProject, currentWorkspace } = useCurrentWorkspaceAndProject();
  const [deleteRunServiceConfig] = useDeleteRunServiceConfigMutation();

  const deleteServiceAndConfig = async (appID: string, serviceID: string) => {
    await deleteRunService({ variables: { serviceID } });
    await deleteRunServiceConfig({ variables: { appID, serviceID } });
    await onDelete?.();
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
    <List>
      {services.map((service) => (
        <Fragment key={service.id}>
          <ListItem.Root
            className="h-[64px] w-full"
            secondaryAction={
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
                    onClick={() => {
                      // TODO handle view service
                    }}
                    className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
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
            }
          >
            <ListItem.Button
              className="grid h-full w-full grid-cols-1 py-2.5 lg:grid-cols-6"
              // href={`/${currentWorkspace.slug}/${currentProject.slug}/deployments/${service.id}`}
              onClick={async () => {
                await router.push(
                  `/${currentWorkspace.slug}/${currentProject.slug}/services/${service.id}`,
                );
              }} // handle view service
              aria-label={`View ${service.config.name}`}
            >
              <div className="col-span-2 grid grid-flow-col place-content-start items-center gap-4">
                <CubeIcon className="h-5 w-5" />
                <div className="grid grid-flow-row items-center">
                  <div className="grid grid-flow-col items-center gap-2">
                    <Text className="truncate font-medium leading-5">
                      {service.config.name}
                    </Text>
                  </div>

                  <Text className="truncate font-normal" color="secondary">
                    {/* TODO wire this to an updatedAt */}
                    Deployed 2 hours ago
                  </Text>
                </div>
              </div>
            </ListItem.Button>
          </ListItem.Root>
          <Divider component="li" />
        </Fragment>
      ))}
    </List>
  );
}
