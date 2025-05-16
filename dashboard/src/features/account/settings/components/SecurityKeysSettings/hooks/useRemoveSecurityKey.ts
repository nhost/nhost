import { useRemoveSecurityKeyMutation } from '@/utils/__generated__/graphql';
import { toast } from 'react-hot-toast';
import useElevatedPermissions from './useElevatedPermissions';
import useGetSecurityKeys from './useGetSecurityKeys';

function useRemoveSecurityKey() {
  const [removeSecurityKeyMutation] = useRemoveSecurityKeyMutation();
  const { elevatePermissions } = useElevatedPermissions();
  const { refetch: refetchSecurityKeys } = useGetSecurityKeys();

  async function removeSecurityKey(id: string) {
    try {
      const permissionGranted = await elevatePermissions();
      if (!permissionGranted) {
        return;
      }
      await removeSecurityKeyMutation({ variables: { id } });
      await refetchSecurityKeys();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return { removeSecurityKey };
}

export default useRemoveSecurityKey;
