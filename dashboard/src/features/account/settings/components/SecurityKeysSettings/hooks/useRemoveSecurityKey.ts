import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useRemoveSecurityKeyMutation } from '@/generated/graphql';
import { useElevation } from '@/providers/Elevation';

function useRemoveSecurityKey() {
  const [removeSecurityKeyMutation] = useRemoveSecurityKeyMutation();
  const { requestElevation } = useElevation();
  const { refetch: refetchSecurityKeys } = useGetSecurityKeys();

  async function removeSecurityKey(id: string) {
    const permissionGranted = await requestElevation();

    if (!permissionGranted) {
      return;
    }

    await execPromiseWithErrorToast(
      async () => {
        await removeSecurityKeyMutation({ variables: { id } });
        await refetchSecurityKeys();
      },
      {
        loadingMessage: 'Removing security key...',
        successMessage: 'Security key has been removed successfully.',
        errorMessage:
          'An error occurred while trying to remove security key. Please try again.',
      },
    );
  }

  return removeSecurityKey;
}

export default useRemoveSecurityKey;
