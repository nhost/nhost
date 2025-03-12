import { useRestoreApplicationDatabasePiTrMutation } from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';

function useRestoreApplicationDatabasePiTR() {
  const [restoreApplicationDatabaseMutation, { loading }] =
    useRestoreApplicationDatabasePiTrMutation();

  async function restoreApplicationDatabase(
    variables: { appId: string; recoveryTarget: string; fromAppId?: string },
    onCompleted?: () => void,
  ) {
    await execPromiseWithErrorToast(
      async () => {
        await restoreApplicationDatabaseMutation({
          variables,
          onCompleted,
        });
      },
      {
        loadingMessage: 'Starting restore from backup...',
        successMessage: 'Backup has been scheduled successfully.',
        errorMessage:
          'An error occurred while attempting to schedule a backup. Please try again.',
      },
    );
  }

  return {
    restoreApplicationDatabase,
    loading,
  };
}

export default useRestoreApplicationDatabasePiTR;
