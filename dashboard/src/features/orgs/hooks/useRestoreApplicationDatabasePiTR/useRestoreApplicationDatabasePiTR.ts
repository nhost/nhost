import { useRestoreApplicationDatabasePiTrMutation } from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useState } from 'react';

function useRestoreApplicationDatabasePiTR() {
  const [mockLoading, setMockLoading] = useState(false);
  const [restoreApplicationDatabaseMutation, { loading }] =
    useRestoreApplicationDatabasePiTrMutation();

  async function restoreApplicationDatabase(
    variables: { appId: string; recoveryTarget: string; fromAppId?: string },
    onSuccess?: () => void,
  ) {
    await execPromiseWithErrorToast(
      async () => {
        await restoreApplicationDatabaseMutation({
          variables,
        });
        onSuccess?.();
      },
      {
        loadingMessage: 'Starting restore from backup...',
        successMessage: 'Backup has been scheduled successfully.',
        errorMessage:
          'An error occurred while attempting to schedule a backup. Please try again.',
      },
    );
  }

  async function restoreApplicationDatabaseMock(
    variables: { appId: string; recoveryTarget: string; fromAppId?: string },
    onSuccess?: () => void,
  ): Promise<void> {
    await execPromiseWithErrorToast(
      async () => {
        setMockLoading(true);
        console.log('restore started');
        await new Promise((resolve) => {
          setTimeout(() => {
            console.log(variables);
            setMockLoading(false);

            console.log('promise resolved');
            resolve(new Error('Whatever'));
          }, 2000);
          console.log('promise created');
        });
        onSuccess?.();
      },
      {
        loadingMessage: 'Starting restore from backup...',
        successMessage: 'Backup has been scheduled successfully.',
        errorMessage:
          'An error occurred while attempting to schedule a backup. Please try again.',
        onError: () => setMockLoading(false),
      },
    );
  }

  return {
    restoreApplicationDatabase,
    loading,
    restoreApplicationDatabaseMock,
    mockLoading,
  };
}

export default useRestoreApplicationDatabasePiTR;
