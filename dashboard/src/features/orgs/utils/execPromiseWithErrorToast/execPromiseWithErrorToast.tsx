import { type Toast, toast } from 'react-hot-toast';
import { ErrorToast } from '@/components/ui/v2/ErrorToast';
import { getToastStyleProps } from '@/utils/constants/settings';

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
    errorMessage: string;
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

    toast(
      (t: Toast) => (
        <ErrorToast toastId={t.id} errorMessage={errorMessage} error={error} />
      ),
      {
        style: {
          maxWidth: '36rem',
          width: '36rem',
          padding: '12px 2px',
          backgroundColor: toastStyle.style!.backgroundColor,
        },
        duration: Number.POSITIVE_INFINITY,
      },
    );

    return null;
  }
}
