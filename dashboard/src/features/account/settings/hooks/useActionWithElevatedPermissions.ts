import { toast } from 'react-hot-toast';
import useElevatedPermissions from '@/features/account/settings/hooks/useElevatedPermissions';
import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';

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
  const { data, refetch } = useGetSecurityKeys();

  async function requestPermissions() {
    // The decision below must run on a known security-keys count. While the
    // query is loading (or after an error) `data` is undefined, so fetch a
    // fresh count before branching rather than treating "unknown" as "has keys".
    let keys = data?.authUserSecurityKeys;
    if (!keys) {
      try {
        keys = (await refetch()).data?.authUserSecurityKeys;
      } catch {
        // leave keys undefined; handled below
      }
    }

    if (!keys) {
      // Don't guess a branch when the count is indeterminate: neither silently
      // skip elevation nor fire a WebAuthn challenge the user may not be able to
      // complete. Surface the failure so they can retry.
      toast.error('Could not verify your security settings. Please try again.');
      return false;
    }

    if (keys.length === 0) {
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
