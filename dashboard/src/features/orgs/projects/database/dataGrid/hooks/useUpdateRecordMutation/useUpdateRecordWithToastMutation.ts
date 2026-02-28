import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getToastStyleProps } from '@/utils/constants/settings';
import { showLoadingToast } from '@/utils/toast';
import type { UseUpdateRecordMutationOptions } from './useUpdateRecordMutation';
import useUpdateRecordMutation from './useUpdateRecordMutation';

export interface UseUpdateRecordWithToastMutationOptions
  extends UseUpdateRecordMutationOptions {}

/**
 * This hook is a wrapper around a fetch call that updates a row in a table. It
 * also shows toast messages based on the result of the mutation.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useUpdateRecordWithToastMutation(
  options: UseUpdateRecordWithToastMutationOptions = {},
) {
  const [toastId, setToastId] = useState<string>();
  const { status, ...rest } = useUpdateRecordMutation(options);

  useEffect(() => {
    if (status === 'loading') {
      const loadingToastId = showLoadingToast('Saving data...', {
        id: 'data-browser-data-save',
        ...getToastStyleProps(),
      });

      setToastId(loadingToastId);
    }

    // Error should be handled where it occurred
    if (status === 'error' && toastId) {
      toast.remove(toastId);
    }

    if (status === 'success' && toastId) {
      setTimeout(() => {
        toast.remove(toastId);
        toast.success(
          'Your changes were successfully saved.',
          getToastStyleProps(),
        );
      }, 300);
    }
  }, [status, toastId]);

  return { status, ...rest };
}
