import { formatDistanceToNow } from 'date-fns';
import {
  BoxIcon,
  CopyIcon,
  Ellipsis as DotsHorizontalIcon,
  EyeIcon,
  Trash2 as TrashIcon,
} from 'lucide-react';
import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { DeleteServiceModal } from '@/features/orgs/projects/common/components/DeleteServiceModal';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { RunService } from '@/features/orgs/projects/common/hooks/useRunServices';
import { ServiceDrawerTitle } from '@/features/orgs/projects/services/components/ServiceDrawerTitle';
import { ServiceForm } from '@/features/orgs/projects/services/components/ServiceForm';
import { getServiceFormInitialData } from '@/features/orgs/projects/services/utils/getServiceFormInitialData';
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
        <ServiceDrawerTitle>
          Edit {service.config?.name ?? 'unset'}
        </ServiceDrawerTitle>
      ),
      component: (
        <ServiceForm
          serviceID={service.id ?? service.serviceID}
          initialData={getServiceFormInitialData(service)}
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
    <div className="flex flex-col">
      {services.map((service) => {
        const serviceID = service.id ?? service.serviceID;
        const serviceName = service.config?.name ?? 'unset';

        return (
          <div
            key={serviceID}
            className="flex h-16 w-full items-center justify-between space-x-4 border-b-1 px-4 py-2"
          >
            <div className="flex w-full flex-row justify-between bg-transparent">
              <div className="flex flex-1 flex-row items-center space-x-4">
                <BoxIcon className="h-5 w-5" />
                <div className="flex flex-col">
                  <h4 className="font-semibold text-sm+">{serviceName}</h4>
                  {isPlatform ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="xs+:flex hidden text-muted-foreground text-sm">
                          Deployed{' '}
                          {service.updatedAt
                            ? formatDistanceToNow(new Date(service.updatedAt))
                            : 'unknown time'}{' '}
                          ago
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{service.updatedAt}</TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
              </div>

              <div className="hidden flex-row items-center space-x-2 md:flex">
                <span className="font-mono text-muted-foreground text-xs">
                  {serviceID}
                </span>
                <Button
                  variant="subtle"
                  size="icon"
                  onClick={() => copy(serviceID!, 'Service Id')}
                  aria-label="Service Id"
                >
                  <CopyIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="subtle"
                  size="icon"
                  aria-label={`More options for ${serviceName}`}
                >
                  <DotsHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => viewService(service)}
                  className="cursor-pointer gap-2"
                >
                  <EyeIcon className="h-4 w-4" />
                  <span>View Service</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:bg-destructive-hover focus:text-destructive"
                  onClick={() => deleteService(service)}
                  disabled={!isPlatform}
                >
                  <TrashIcon className="h-4 w-4" />
                  <span>Delete Service</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}
