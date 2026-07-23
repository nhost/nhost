import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useRestoreApplicationDatabaseMutation } from '@/utils/__generated__/graphql';

function useRestoreApplicationDatabase() {
  const [restoreApplicationDatabaseMutation, { loading }] =
    useRestoreApplicationDatabaseMutation();

  async function restoreApplicationDatabase(
    variables: {
      appId: string;
      backupId: string;
      fromAppId: string | null;
    },
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

export default useRestoreApplicationDatabase;
