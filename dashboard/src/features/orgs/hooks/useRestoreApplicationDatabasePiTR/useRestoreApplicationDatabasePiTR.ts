import { useQueryClient } from '@tanstack/react-query';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useRestoreApplicationDatabasePiTrMutation } from '@/generated/graphql';

interface RestoreApplicationDatabasePiTRToastMessages {
  errorMessage: string;
  loadingMessage: string;
  successMessage: string;
}

const DATABASE_QUERY_KEY = ['default'] as const;

function useRestoreApplicationDatabasePiTR() {
  const queryClient = useQueryClient();
  const [restoreApplicationDatabaseMutation, { loading }] =
    useRestoreApplicationDatabasePiTrMutation();

  async function restoreApplicationDatabase(
    variables: {
      appId: string;
      recoveryTarget: string;
      fromAppId: string | null;
    },
    onCompleted: VoidFunction,
    toastMessages: RestoreApplicationDatabasePiTRToastMessages,
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

export default useRestoreApplicationDatabasePiTR;
