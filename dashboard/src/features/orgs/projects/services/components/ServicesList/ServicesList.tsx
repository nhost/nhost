import { formatDistanceToNow } from 'date-fns';
import {
  BoxIcon,
  CopyIcon,
  Ellipsis as DotsHorizontalIcon,
  EyeIcon,
  Trash2 as TrashIcon,
} from 'lucide-react';
import { useDialog } from '@/components/common/DialogProvider';
import { Box } from '@/components/ui/v2/Box';
import { IconButton } from '@/components/ui/v2/IconButton';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { DeleteServiceModal } from '@/features/orgs/projects/common/components/DeleteServiceModal';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { RunService } from '@/features/orgs/projects/common/hooks/useRunServices';
import { ServiceForm } from '@/features/orgs/projects/services/components/ServiceForm';
import type { PortTypes } from '@/features/orgs/projects/services/components/ServiceForm/components/PortsFormSection/PortsFormSectionTypes';
import {
  defaultServiceFormValues,
  type ServiceFormInitialData,
} from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import { copy } from '@/utils/copy';

interface ServicesListProps {
  /**
   * The run services fetched from entering the users page.
   */
  services: RunService[];

  /**
   * Function to be called after a submitting the form for either creating or updating a service.
   */
  onCreateOrUpdate: () => Promise<unknown>;

  /**
   * Function to be called after a successful delete action.
   */
  onDelete?: () => Promise<unknown>;
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
          <BoxIcon className="h-5 w-5" />
          <Text>Edit {service.config?.name ?? 'unset'}</Text>
        </Box>
      ),
      component: (
        <ServiceForm
          serviceID={service.id ?? service.serviceID}
          initialData={
            {
              ...service.config,
              image: service.config?.image?.image,
              pullCredentials: service.config?.image?.pullCredentials,
              subdomain: service.subdomain,
              command: service.config?.command?.map((arg) => ({
                argument: arg,
              })),
              ports: service.config?.ports?.map((item) => ({
                port: item.port,
                type: item.type as PortTypes,
                publish: item.publish,
                ingresses: item.ingresses,
                rateLimit: item.rateLimit,
              })),
              compute:
                service.config?.resources?.compute ??
                defaultServiceFormValues.compute,
              replicas:
                service.config?.resources?.replicas ??
                defaultServiceFormValues.replicas,
              autoscaler:
                service?.config?.resources?.autoscaler ??
                defaultServiceFormValues.autoscaler,
              storage: service.config?.resources?.storage,
            } as ServiceFormInitialData
          }
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
              <BoxIcon className="h-5 w-5" />
              <div className="flex flex-col">
                <Text variant="h4" className="font-semibold">
                  {service.config?.name ?? 'unset'}
                </Text>
                {isPlatform ? (
                  <Tooltip title={service.updatedAt}>
                    <span className="xs+:flex hidden cursor-pointer text-slate-500 text-sm">
                      Deployed{' '}
                      {formatDistanceToNow(new Date(service.updatedAt!))} ago
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
                  copy(service.id ?? service.serviceID!, 'Service Id');
                  event.stopPropagation();
                }}
                aria-label="Service Id"
              >
                <CopyIcon className="h-4 w-4" />
              </IconButton>
            </div>
          </Box>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                variant="borderless"
                color="secondary"
                aria-label={`More options for ${service.config?.name ?? 'unset'}`}
                onClick={(event) => event.stopPropagation()}
              >
                <DotsHorizontalIcon />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-0">
              <DropdownMenuItem
                onClick={() => viewService(service)}
                className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
              >
                <EyeIcon className="h-4 w-4" />
                <span>View Service</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteService(service);
                }}
                disabled={!isPlatform}
              >
                <TrashIcon className="h-4 w-4" />
                <span>Delete Service</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Box>
      ))}
    </Box>
  );
}
