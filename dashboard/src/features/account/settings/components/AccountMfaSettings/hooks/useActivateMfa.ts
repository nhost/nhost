import useElevatedPermissions from '@/features/account/settings/hooks/useElevatedPermissions';
import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';
import type { ActivateMfaHandlerResult } from '@nhost/nextjs';
import { toast } from 'react-hot-toast';

interface Props {
  activateMfaFn: (code: string) => Promise<ActivateMfaHandlerResult>;
  onSuccess: () => void;
}

function useActivateMfa({ activateMfaFn, onSuccess }: Props) {
  const { elevated, elevatePermissions } = useElevatedPermissions();
  const { data } = useGetSecurityKeys();

  async function requestPermissions() {
    if (elevated || data?.authUserSecurityKeys.length === 0) {
      return true;
    }
    const isPermissionsElevated = await elevatePermissions();
    return isPermissionsElevated;
  }

  async function activateMfa(code: string) {
    let isSuccess = false;
    const permissionGranted = await requestPermissions();

    if (!permissionGranted) {
      return isSuccess;
    }

    const { error, isError } = await activateMfaFn(code);

    if (isError) {
      toast.error(error?.message || 'Something went wrong.');
    } else {
      toast.success('Multi-factor authentication has been enabled');
      onSuccess();
      isSuccess = true;
    }

    return isSuccess;
  }
  return activateMfa;
}

export default useActivateMfa;
