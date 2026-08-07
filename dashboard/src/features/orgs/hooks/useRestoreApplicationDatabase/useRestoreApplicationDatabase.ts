import { useQueryClient } from '@tanstack/react-query';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useRestoreApplicationDatabaseMutation } from '@/generated/graphql';

interface RestoreApplicationDatabaseToastMessages {
  errorMessage: string;
  loadingMessage: string;
  successMessage: string;
}

const DATABASE_QUERY_KEY = ['default'] as const;

function useRestoreApplicationDatabase() {
  const queryClient = useQueryClient();
  const [restoreApplicationDatabaseMutation, { loading }] =
    useRestoreApplicationDatabaseMutation();

  async function restoreApplicationDatabase(
    variables: {
      appId: string;
      backupId: string;
      fromAppId: string | null;
    },
    onCompleted: VoidFunction,
    toastMessages: RestoreApplicationDatabaseToastMessages,
  ) {
    await execPromiseWithErrorToast(async () => {
      await restoreApplicationDatabaseMutation({
        variables,
        onCompleted,
      });
      await queryClient.invalidateQueries({
        queryKey: DATABASE_QUERY_KEY,
        refetchType: 'none',
      });
    }, toastMessages);
  }

  return {
    restoreApplicationDatabase,
    loading,
  };
}

export default useRestoreApplicationDatabase;
