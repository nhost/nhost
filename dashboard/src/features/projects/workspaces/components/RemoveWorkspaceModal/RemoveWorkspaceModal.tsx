import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { getServerError } from '@/utils/getServerError';
import {
  GetAllWorkspacesAndProjectsDocument,
  useDeleteWorkspaceMutation,
} from '@/utils/__generated__/graphql';
import router from 'next/router';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

export interface RemoveWorkspaceModalProps {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
}

export default function RemoveWorkspaceModal({
  onSubmit,
  onCancel,
}: RemoveWorkspaceModalProps) {
  const [remove, setRemove] = useState(false);

  const [deleteWorkspace, { loading, error: mutationError, client }] =
    useDeleteWorkspaceMutation();

  const { currentWorkspace } = useCurrentWorkspaceAndProject();

  async function handleClick() {
    try {
      await toast.promise(
        deleteWorkspace({
          variables: {
            id: currentWorkspace.id,
          },
        }),
        {
          loading: 'Deleting workspace...',
          success: `Workspace "${currentWorkspace.name}" has been deleted successfully.`,
          error: getServerError(
            `An error occurred while trying to delete the workspace "${currentWorkspace.name}". Please try again.`,
          ),
        },
        getToastStyleProps(),
      );
    } catch (error) {
      // TODO: Display error to user and use a logging solution
      return;
    }
    await onSubmit?.();
    await router.push('/');
    await client.refetchQueries({
      include: [GetAllWorkspacesAndProjectsDocument],
    });
  }

  return (
    <Box className="grid grid-flow-row gap-4 px-6 pt-4 pb-6">
      <Box className="border-y py-2">
        <Checkbox
          id="accept-remove"
          label={`I'm sure I want to delete ${currentWorkspace.name}`}
          className="py-2"
          checked={remove}
          onChange={(_event, checked) => setRemove(checked)}
          aria-label="Confirm Delete Workspace"
        />
      </Box>

      <div className="grid grid-flow-row gap-2">
        {mutationError && (
          <Alert severity="error">{getErrorMessage(mutationError)}</Alert>
        )}

        <Button
          color="error"
          onClick={handleClick}
          disabled={!remove || !!mutationError}
          className=""
          loading={loading}
        >
          Delete
        </Button>

        <Button variant="outlined" color="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Box>
  );
}
