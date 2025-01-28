import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { Text } from '@/components/ui/v2/Text';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { type RunService } from '@/hooks/useRunServices';
import {
  useDeleteRunServiceConfigMutation,
  useDeleteRunServiceMutation,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface DeleteServiceModalProps {
  service: RunService;
  onDelete?: () => Promise<any>;
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
      variables: { appID: project.id, serviceID: service.id },
    });
    await onDelete?.();
    close();
  };

  async function handleClick() {
    setLoadingRemove(true);

    await execPromiseWithErrorToast(() => deleteServiceAndConfig(), {
      loadingMessage: 'Deleting the service...',
      successMessage: 'The service has been deleted successfully.',
      errorMessage:
        'An error occurred while deleting the service. Please try again.',
    });
  }

  return (
    <Box className={twMerge('w-full rounded-lg p-6 text-left')}>
      <div className="grid grid-flow-row gap-1">
        <Text variant="h3" component="h2">
          Delete Service {service?.config?.name}
        </Text>

        <Text variant="subtitle2">
          Are you sure you want to delete this service?
        </Text>

        <Text
          variant="subtitle2"
          className="font-bold"
          sx={{ color: (theme) => `${theme.palette.error.main} !important` }}
        >
          This cannot be undone.
        </Text>

        <Box className="my-4">
          <Checkbox
            id="accept-1"
            label={`I'm sure I want to delete ${service?.config?.name}`}
            className="py-2"
            checked={remove}
            onChange={(_event, checked) => setRemove(checked)}
            aria-label="Confirm Delete Project #1"
          />
        </Box>

        <div className="grid grid-flow-row gap-2">
          <Button
            color="error"
            onClick={handleClick}
            disabled={!remove}
            loading={loadingRemove}
          >
            Delete Service
          </Button>

          <Button variant="outlined" color="secondary" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </Box>
  );
}
