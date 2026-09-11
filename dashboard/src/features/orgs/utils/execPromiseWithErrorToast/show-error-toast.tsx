import type { ApolloError } from '@apollo/client';
import type { Toast } from 'react-hot-toast';
import { toast } from 'react-hot-toast';
import ErrorToast from '@/features/orgs/utils/execPromiseWithErrorToast/ErrorToast';
import { getToastStyleProps } from '@/utils/constants/settings';

export default function showErrorToast(
  error: ApolloError | Error,
  errorMessage: string,
): string {
  const toastStyle = getToastStyleProps();

  return toast(
    (toastInstance: Toast) => (
      <ErrorToast
        toastId={toastInstance.id}
        errorMessage={errorMessage}
        error={error}
      />
    ),
    {
      className: 'error-toast',
      duration: Number.POSITIVE_INFINITY,
      style: toastStyle.style,
    },
  );
}
