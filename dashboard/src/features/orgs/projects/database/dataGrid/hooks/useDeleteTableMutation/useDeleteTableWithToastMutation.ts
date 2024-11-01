import type { UseDeleteTableMutationOptions } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteTableMutation';
import { showLoadingToast, triggerToast } from '@/utils/toast';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import useDeleteTableMutation from './useDeleteTableMutation';

export interface UseDeleteTableWithToastMutationOptions
  extends UseDeleteTableMutationOptions {}

/**
 * This hook is a wrapper around a fetch call that deletes one or more tables
 * from the schema. It also shows toast messages based on the result of the
 * mutation.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDeleteTableWithToastMutation(
  options: UseDeleteTableWithToastMutationOptions = {},
) {
  const [toastId, setToastId] = useState<string>();
  const { status, error, ...rest } = useDeleteTableMutation(options);

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
