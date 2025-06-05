import useElevatedPermissions from '@/features/account/settings/hooks/useElevatedPermissions';
import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';
import { useRemoveSecurityKeyMutation } from '@/utils/__generated__/graphql';

function useRemoveSecurityKey() {
  const [removeSecurityKeyMutation] = useRemoveSecurityKeyMutation();
  const { elevatePermissions } = useElevatedPermissions();
  const { refetch: refetchSecurityKeys } = useGetSecurityKeys();

  async function removeSecurityKey(id: string) {
    const permissionGranted = await elevatePermissions(true);

    if (permissionGranted) {
      await removeSecurityKeyMutation({ variables: { id } });
      await refetchSecurityKeys();
    }
  }

  return removeSecurityKey;
}

export default useRemoveSecurityKey;
