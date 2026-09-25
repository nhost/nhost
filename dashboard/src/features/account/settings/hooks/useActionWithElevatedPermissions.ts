import { toast } from 'react-hot-toast';
import { useElevation } from '@/providers/Elevation';

// biome-ignore lint/suspicious/noExplicitAny: TODO
type Action = (...args: any[]) => Promise<any>;

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

interface Props<Fn extends Action> {
  actionFn: Fn;
  onSuccess?: (result: UnwrapPromise<ReturnType<Fn>>) => void;
  onError?: () => void;
  successMessage?: string;
}

function useActionWithElevatedPermissions<F extends Action>({
  actionFn,
  onSuccess,
  onError,
  successMessage,
}: Props<F>) {
  const { requestElevation } = useElevation();

  async function actionWithElevatedPermissions(...args: Parameters<F>) {
    let isSuccess = false;
    const permissionGranted = await requestElevation();
    if (!permissionGranted) {
      return isSuccess;
    }
    try {
      const response = await actionFn(...args);
      toast.success(successMessage || 'Success.');
      onSuccess?.(response as UnwrapPromise<ReturnType<F>>);
      isSuccess = true;
    } catch (error) {
      toast.error(error?.message || 'Something went wrong.');
      onError?.();
    }

    return isSuccess;
  }
  return actionWithElevatedPermissions;
}

export default useActionWithElevatedPermissions;
