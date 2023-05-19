import type { UseDeleteColumnMutationOptions } from '@/features/database/dataGrid/hooks/useDeleteColumnMutation';
import { showLoadingToast, triggerToast } from '@/utils/toast';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import useDeleteColumnMutation from './useDeleteColumnMutation';

export interface UseDeleteColumnWithToastMutationOptions
  extends UseDeleteColumnMutationOptions {}

/**
 * This hook is a wrapper around a fetch call that deletes one or more columns
 * from the table. It also shows toast messages based on the result of the
 * mutation.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDeleteColumnWithToastMutation(
  options: UseDeleteColumnWithToastMutationOptions = {},
) {
  const [toastId, setToastId] = useState<string>();
  const { status, error, ...rest } = useDeleteColumnMutation(options);

  useEffect(() => {
    if (status === 'loading') {
      const loadingToastId = showLoadingToast('Deleting column...', {
        id: 'data-browser-column-delete',
      });

      setToastId(loadingToastId);
    }

    if (status === 'error' && toastId) {
      toast.remove(toastId);

      if (error && error instanceof Error) {
        triggerToast(
          error.message || 'An error occurred while deleting the column.',
        );
      } else {
        triggerToast('An error occurred while deleting the column.');
      }
    }

    if (status === 'success' && toastId) {
      toast.remove(toastId);

      triggerToast('The column has been deleted successfully.');
    }
  }, [status, error, toastId]);

  return { status, ...rest };
}
