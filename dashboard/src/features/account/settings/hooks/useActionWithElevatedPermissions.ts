import useElevatedPermissions from '@/features/account/settings/hooks/useElevatedPermissions';
import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';
import type { AuthErrorPayload } from '@nhost/nextjs';
import { toast } from 'react-hot-toast';

type Action = (...args: any) => Promise<ActionResult>;

type ActionResult = {
  isError: boolean;
  error: AuthErrorPayload;
};

interface Props<Fn extends Action> {
  actionFn: Fn;
  onSuccess?: () => void;
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

  async function actionWithElevatedPermissions(code: string) {
    let isSuccess = false;
    const permissionGranted = await requestPermissions();

    if (!permissionGranted) {
      return isSuccess;
    }

    const { error, isError } = await actionFn(code);

    if (isError) {
      toast.error(error?.message || 'Something went wrong.');
      onError?.();
    } else {
      toast.success(successMessage || 'Success');
      onSuccess?.();
      isSuccess = true;
    }

    return isSuccess;
  }
  return actionWithElevatedPermissions;
}

export default useActionWithElevatedPermissions;
