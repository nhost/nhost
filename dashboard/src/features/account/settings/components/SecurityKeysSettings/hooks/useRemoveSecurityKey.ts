import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';
import { useRemoveSecurityKeyMutation } from '@/generated/graphql';
import { useElevation } from '@/providers/Elevation';

function useRemoveSecurityKey() {
  const [removeSecurityKeyMutation] = useRemoveSecurityKeyMutation();
  const { requestElevation } = useElevation();
  const { refetch: refetchSecurityKeys } = useGetSecurityKeys();

  async function removeSecurityKey(id: string) {
    const permissionGranted = await requestElevation();

    if (permissionGranted) {
      await removeSecurityKeyMutation({ variables: { id } });
      await refetchSecurityKeys();
    }
  }

  return removeSecurityKey;
}

export default useRemoveSecurityKey;
