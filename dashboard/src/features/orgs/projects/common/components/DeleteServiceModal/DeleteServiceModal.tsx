import { useState } from 'react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import type { RunService } from '@/features/orgs/projects/common/hooks/useRunServices';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useDeleteRunServiceConfigMutation,
  useDeleteRunServiceMutation,
} from '@/generated/graphql';

export interface DeleteServiceModalProps {
  service: RunService;
  onDelete?: () => Promise<unknown>;
  close: () => void;
}

export default function DeleteServiceModal({
  service,
  onDelete,
  close,
}: DeleteServiceModalProps) {
  const [remove, setRemove] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState(false);
  const { project } = useProject();
  const [deleteRunService] = useDeleteRunServiceMutation();
  const [deleteRunServiceConfig] = useDeleteRunServiceConfigMutation();

  const deleteServiceAndConfig = async () => {
    await deleteRunService({ variables: { serviceID: service.id } });
    await deleteRunServiceConfig({
      variables: { appID: project?.id, serviceID: service.id },
    });
    await onDelete?.();
    close();
  };

  async function handleClick() {
    setLoadingRemove(true);

    try {
      await execPromiseWithErrorToast(() => deleteServiceAndConfig(), {
        loadingMessage: 'Deleting the service...',
        successMessage: 'The service has been deleted successfully.',
        errorMessage:
          'An error occurred while deleting the service. Please try again.',
      });
    } finally {
      setLoadingRemove(false);
    }
  }

  return (
    <div className="w-full rounded-lg p-6 text-left">
      <div className="grid grid-flow-row gap-1">
        <h2 className="font-medium text-lg">
          Delete Service {service?.config?.name}
        </h2>

        <p className="text-muted-foreground text-sm">
          Are you sure you want to delete this service?
        </p>

        <p className="font-bold text-destructive text-sm">
          This cannot be undone.
        </p>

        <div className="my-4">
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="accept-1"
              checked={remove}
              onCheckedChange={(checked) => setRemove(checked === true)}
              aria-label="Confirm Delete Project #1"
            />
            <Label htmlFor="accept-1" className="cursor-pointer font-normal">
              {`I'm sure I want to delete ${service?.config?.name}`}
            </Label>
          </div>
        </div>

        <div className="grid grid-flow-row gap-2">
          <ButtonWithLoading
            variant="destructive"
            onClick={handleClick}
            disabled={!remove}
            loading={loadingRemove}
          >
            Delete Service
          </ButtonWithLoading>

          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
