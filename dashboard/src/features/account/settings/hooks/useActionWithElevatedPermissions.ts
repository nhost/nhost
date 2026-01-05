import useElevatedPermissions from '@/features/account/settings/hooks/useElevatedPermissions';
import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';
import { toast } from 'react-hot-toast';

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
  const elevatePermissions = useElevatedPermissions();
  const { data } = useGetSecurityKeys();

  async function requestPermissions() {
    if (data?.authUserSecurityKeys.length === 0) {
      return true;
    }
    const isPermissionsElevated = await elevatePermissions();
    return isPermissionsElevated;
  }

  async function actionWithElevatedPermissions(...args: Parameters<F>) {
    let isSuccess = false;
    const permissionGranted = await requestPermissions();
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
