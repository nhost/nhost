import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { UseDeleteDatabaseObjectMutationOptions } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteDatabaseObjectMutation';
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
      const loadingToastId = showLoadingToast('Deleting table...', {
        id: 'data-browser-table-delete',
      });

      setToastId(loadingToastId);
    }

    if (status === 'error' && toastId) {
      toast.remove(toastId);

      if (error && error instanceof Error) {
        triggerToast(
          error.message || 'An error occurred while deleting the table.',
        );
      } else {
        triggerToast('An error occurred while deleting the table.');
      }
    }

    if (status === 'success' && toastId) {
      toast.remove(toastId);

      triggerToast('The table has been deleted successfully.');
    }
  }, [status, error, toastId]);

  return { status, ...rest };
}
