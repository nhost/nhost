import useGetSecurityKeys from '@/features/account/settings/components/SecurityKeysSettings/hooks/useGetSecurityKeys';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useAddSecurityKey } from '@nhost/nextjs';
import { toast } from 'react-hot-toast';
import useElevatedPermissions from './useElevatedPermissions';
import { type NewSecurityKeyFormValues } from './useNewSecurityKeyForm';

interface Props {
  onSuccess: () => void;
}

function useOnAddNewSecurityKeyHandler({ onSuccess }: Props) {
  const { data, refetch } = useGetSecurityKeys();
  const { add } = useAddSecurityKey();

  const { elevated, elevatePermissions } = useElevatedPermissions();

  async function requestPermissions() {
    if (elevated || data?.authUserSecurityKeys.length === 0) {
      return true;
    }
    const isPermissionsElevated = await elevatePermissions();
    return isPermissionsElevated;
  }

  async function onSubmit(values: NewSecurityKeyFormValues) {
    const permissionGranted = await requestPermissions();
    if (!permissionGranted) {
      return;
    }
    const { nickname } = values;

    const { isError, error } = await add(nickname);
    if (isError) {
      toast.error(error?.message, getToastStyleProps());
    }
    await refetch();
    onSuccess();
  }

  return onSubmit;
}

export default useOnAddNewSecurityKeyHandler;
