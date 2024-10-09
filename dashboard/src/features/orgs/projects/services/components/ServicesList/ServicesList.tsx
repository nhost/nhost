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
import { DeleteServiceModal } from '@/features/orgs/projects/common/components/DeleteServiceModal';
import { ServiceForm } from '@/features/orgs/projects/services/components/ServiceForm';
import { type PortTypes } from '@/features/orgs/projects/services/components/ServiceForm/components/PortsFormSection/PortsFormSectionTypes';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { type RunService } from '@/hooks/useRunServices';
import { copy } from '@/utils/copy';
import { formatDistanceToNow } from 'date-fns';

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
  const isPlatform = useIsPlatform();
  const { openDrawer, openDialog, closeDialog } = useDialog();

  const viewService = async (service: RunService) => {
    openDrawer({
      title: (
        <Box className="flex flex-row items-center space-x-2">
          <CubeIcon className="h-5 w-5" />
          <Text>Edit {service.config?.name ?? 'unset'}</Text>
        </Box>
      ),
      component: (
        <ServiceForm
          serviceID={service.id ?? service.serviceID}
          initialData={{
            ...service.config,
            image: service.config?.image?.image,
            pullCredentials: service.config?.image?.pullCredentials,
            subdomain: service.subdomain,
            command: service.config?.command?.join(' '),
            ports: service.config?.ports?.map((item) => ({
              port: item.port,
              type: item.type as PortTypes,
              publish: item.publish,
              ingresses: item.ingresses,
              rateLimit: item.rateLimit,
            })),
            compute: service.config?.resources?.compute ?? {
              cpu: 62,
              memory: 128,
            },
            replicas: service.config?.resources?.replicas,
            autoscaler: service?.config?.resources?.autoscaler,
            storage: service.config?.resources?.storage,
          }}
          onSubmit={() => onCreateOrUpdate()}
        />
      ),
    });
  };

  const deleteService = async (service: RunService) => {
    openDialog({
      component: (
        <DeleteServiceModal
          service={service}
          close={closeDialog}
          onDelete={onDelete}
        />
      ),
    });
  };

  return (
    <Box className="flex flex-col">
      {services.map((service) => (
        <Box
          key={service.id ?? service.serviceID}
          className="flex h-[64px] w-full cursor-pointer items-center justify-between space-x-4 border-b-1 px-4 py-2 transition-colors"
          sx={{
            [`&:hover`]: {
              backgroundColor: 'action.hover',
            },
          }}
          onClick={() => viewService(service)}
        >
          <Box
            className="flex w-full flex-row justify-between"
            sx={{
              backgroundColor: 'transparent',
            }}
          >
            <div className="flex flex-1 flex-row items-center space-x-4">
              <CubeIcon className="h-5 w-5" />
              <div className="flex flex-col">
                <Text variant="h4" className="font-semibold">
                  {service.config?.name ?? 'unset'}
                </Text>
                {isPlatform ? (
                  <Tooltip title={service.updatedAt}>
                    <span className="hidden cursor-pointer text-sm text-slate-500 xs+:flex">
                      Deployed{' '}
                      {formatDistanceToNow(new Date(service.updatedAt))} ago
                    </span>
                  </Tooltip>
                ) : null}
              </div>
            </div>

            <div className="hidden flex-row items-center space-x-2 md:flex">
              <Text variant="subtitle1" className="font-mono text-xs">
                {service.id ?? service.serviceID}
              </Text>
              <IconButton
                variant="borderless"
                color="secondary"
                onClick={(event) => {
                  copy(service.id ?? service.serviceID, 'Service Id');
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
                onClick={(e) => {
                  e.stopPropagation();
                  deleteService(service);
                }}
                disabled={!isPlatform}
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
