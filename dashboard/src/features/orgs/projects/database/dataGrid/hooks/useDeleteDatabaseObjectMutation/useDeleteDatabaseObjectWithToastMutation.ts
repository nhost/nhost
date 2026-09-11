import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { UseDeleteDatabaseObjectMutationOptions } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteDatabaseObjectMutation';
import showErrorToast from '@/features/orgs/utils/execPromiseWithErrorToast/show-error-toast';
import { isMetadataVersionConflictError } from '@/utils/hasura-api/metadata-version-conflict-error';
import { showLoadingToast, triggerToast } from '@/utils/toast';
import useDeleteDatabaseObjectMutation from './useDeleteDatabaseObjectMutation';

export interface UseDeleteDatabaseObjectWithToastMutationOptions
  extends UseDeleteDatabaseObjectMutationOptions {}

/**
 * This hook is a wrapper around a fetch call that deletes one or more database
 * objects from the schema. It also shows toast messages based on the result of
 * the mutation.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDeleteDatabaseObjectWithToastMutation(
  options: UseDeleteDatabaseObjectWithToastMutationOptions = {},
) {
  const [toastId, setToastId] = useState<string>();
  const { status, error, ...rest } = useDeleteDatabaseObjectMutation(options);

  useEffect(() => {
    if (status === 'loading') {
      const loadingToastId = showLoadingToast('Deleting object...', {
        id: 'data-browser-table-delete',
      });

      setToastId(loadingToastId);
    }

    if (status === 'error') {
      const isMetadataConflict = isMetadataVersionConflictError(error);

      if (!toastId && !isMetadataConflict) {
        return;
      }

      if (toastId) {
        toast.remove(toastId);
      }

      if (isMetadataConflict) {
        showErrorToast(error, error.message);
      } else if (error instanceof Error) {
        triggerToast(
          error.message || 'An error occurred while deleting the object.',
        );
      } else {
        triggerToast('An error occurred while deleting the object.');
      }
    }

    if (status === 'success' && toastId) {
      toast.remove(toastId);

      triggerToast('The object has been deleted successfully.');
    }
  }, [status, error, toastId]);

  return { status, ...rest };
}
