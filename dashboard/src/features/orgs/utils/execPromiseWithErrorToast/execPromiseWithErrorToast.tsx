import type { ApolloError } from '@apollo/client';
import { type Toast, toast } from 'react-hot-toast';
import ErrorToast from '@/features/orgs/utils/execPromiseWithErrorToast/ErrorToast';
import { getToastStyleProps } from '@/utils/constants/settings';

type ErrorExtensions = {
  internal?: { error?: { message?: string } };
};

const getInternalErrorMessage = (
  error: Error | ApolloError | undefined,
): string | null => {
  if (!error) {
    return null;
  }

  if ('graphQLErrors' in error) {
    const graphqlError = error.graphQLErrors[0];
    const extensions = graphqlError?.extensions as ErrorExtensions | undefined;
    return (
      extensions?.internal?.error?.message || graphqlError?.message || null
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return null;
};

function resolveErrorMessage(
  error: Error,
  errorMessage: string | ((error: Error) => string),
): string {
  if (typeof errorMessage === 'function') {
    return errorMessage(error);
  }

  return getInternalErrorMessage(error) || errorMessage;
}

export default async function execPromiseWithErrorToast(
  call: () => Promise<unknown>,
  {
    loadingMessage,
    successMessage,
    errorMessage,
    onError,
  }: {
    loadingMessage: string;
    successMessage: string;
    errorMessage: string | ((error: Error) => string);
    onError?: (error: Error) => void;
  },
) {
  let loadingToastId: string | null = null;

  const toastStyle = getToastStyleProps();

  try {
    loadingToastId = toast.loading(loadingMessage, {
      style: toastStyle.style,
      ...toastStyle.loading,
    });

    const result = await call();

    toast.dismiss(loadingToastId);

    toast.success(successMessage, {
      style: toastStyle.style,
      ...toastStyle.success,
    });

    return result;
  } catch (error) {
    if (loadingToastId) {
      toast.dismiss(loadingToastId);
    }

    onError?.(error);

    const resolvedErrorMessage = resolveErrorMessage(error, errorMessage);

    toast(
      (t: Toast) => (
        <ErrorToast
          toastId={t.id}
          errorMessage={resolvedErrorMessage}
          error={error}
        />
      ),
      {
        className: 'error-toast',
        duration: Number.POSITIVE_INFINITY,
        style: toastStyle.style,
      },
    );

    return null;
  }
}
