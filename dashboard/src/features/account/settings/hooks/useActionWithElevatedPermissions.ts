import useElevatedPermissions from '@/features/account/settings/hooks/useElevatedPermissions';
import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';
import type { AuthErrorPayload } from '@nhost/nextjs';
import { toast } from 'react-hot-toast';

type Action = (...args: any[]) => Promise<ActionResult>;

type ActionResult = {
  isError?: boolean;
  error: AuthErrorPayload;
};
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
  const { elevated, elevatePermissions } = useElevatedPermissions();
  const { data } = useGetSecurityKeys();

  async function requestPermissions() {
    if (elevated || data?.authUserSecurityKeys.length === 0) {
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

    const response = await actionFn(...args);
    if (response.error) {
      toast.error(response.error?.message || 'Something went wrong.');
      onError?.();
    } else {
      toast.success(successMessage || 'Success');
      onSuccess?.(response as UnwrapPromise<ReturnType<F>>);
      isSuccess = true;
    }

    return isSuccess;
  }
  return actionWithElevatedPermissions;
}

export default useActionWithElevatedPermissions;
