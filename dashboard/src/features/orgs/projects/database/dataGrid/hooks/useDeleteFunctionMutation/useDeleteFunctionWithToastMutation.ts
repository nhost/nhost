import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { showLoadingToast, triggerToast } from '@/utils/toast';
import type { DeleteFunctionOptions } from './deleteFunction';
import useDeleteFunctionMutation from './useDeleteFunctionMutation';

export interface UseDeleteFunctionWithToastMutationOptions
  extends Partial<DeleteFunctionOptions> {}

/**
 * This hook is a wrapper around a fetch call that deletes a function
 * from the schema. It also shows toast messages based on the result of the
 * mutation.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDeleteFunctionWithToastMutation(
  options: UseDeleteFunctionWithToastMutationOptions = {},
) {
  const [toastId, setToastId] = useState<string>();
  const { status, error, ...rest } = useDeleteFunctionMutation(options);

  useEffect(() => {
    if (status === 'loading') {
      const loadingToastId = showLoadingToast('Deleting function...', {
        id: 'data-browser-function-delete',
      });

      setToastId(loadingToastId);
    }

    if (status === 'error' && toastId) {
      toast.remove(toastId);

      if (error && error instanceof Error) {
        triggerToast(
          error.message || 'An error occurred while deleting the function.',
        );
      } else {
        triggerToast('An error occurred while deleting the function.');
      }
    }

    if (status === 'success' && toastId) {
      toast.remove(toastId);

      triggerToast('The function has been deleted successfully.');
    }
  }, [status, error, toastId]);

  return { status, ...rest };
}
