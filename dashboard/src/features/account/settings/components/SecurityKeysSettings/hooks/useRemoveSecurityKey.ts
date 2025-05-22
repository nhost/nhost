import { useRemoveSecurityKeyMutation } from '@/utils/__generated__/graphql';
import useElevatedPermissions from './useElevatedPermissions';
import useGetSecurityKeys from './useGetSecurityKeys';

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
