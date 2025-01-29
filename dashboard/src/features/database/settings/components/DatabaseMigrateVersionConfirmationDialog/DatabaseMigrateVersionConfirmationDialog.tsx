import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { useEstimatedDatabaseMigrationDowntime } from '@/features/database/common/hooks/useEstimatedDatabaseMigrationDowntime';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import {
  GetPostgresSettingsDocument,
  GetWorkspaceAndProjectDocument,
  useUpdateDatabaseVersionMutation,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface DatabaseMigrateVersionConfirmationDialogProps {
  /**
   * Function to be called when the user clicks the cancel button.
   */
  onCancel: () => void;
  /**
   * Function to be called when the user clicks the proceed button.
   */
  onProceed: () => void;
  /**
   * New version to migrate to.
   */
  postgresVersion: string;
}

export default function DatabaseMigrateVersionConfirmationDialog({
  onCancel,
  onProceed,
  postgresVersion,
}: DatabaseMigrateVersionConfirmationDialogProps) {
  const isPlatform = useIsPlatform();
  const { openDialog, closeDialog } = useDialog();
  const localMimirClient = useLocalMimirClient();
  const [loading, setLoading] = useState(false);
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updatePostgresMajor] = useUpdateDatabaseVersionMutation({
    refetchQueries: [
      GetPostgresSettingsDocument,
      GetWorkspaceAndProjectDocument,
    ],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { downtime } = useEstimatedDatabaseMigrationDowntime({
    fetchPolicy: 'cache-only',
  });

  async function handleClick() {
    setLoading(true);

    await execPromiseWithErrorToast(
      async () => {
        await updatePostgresMajor({
          variables: {
            appId: currentProject.id,
            version: postgresVersion,
          },
        });

        onProceed();
        closeDialog();

        if (!isPlatform) {
          openDialog({
            title: 'Apply your changes',
            component: <ApplyLocalSettingsDialog />,
            props: {
              PaperProps: {
                className: 'max-w-2xl',
              },
            },
          });
        }
      },
      {
        loadingMessage: 'Updating postgres version...',
        successMessage: 'Major version upgrade started.',
        errorMessage:
          'An error occurred while updating the database version. Please try again later.',
      },
    );
  }

  return (
    <Box className={twMerge('w-full rounded-lg p-6 pt-0 text-left')}>
      <div className="grid grid-flow-row gap-6">
        <Text>
          The upgrade process will require an{' '}
          <span className="font-semibold">
            estimated {downtime} of downtime
          </span>
          . To continue with the upgrade process, click on &quot;Proceed&quot;.
        </Text>

        <div className="grid grid-flow-col gap-4">
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => {
              onCancel();
              closeDialog();
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleClick} loading={loading}>
            Proceed
          </Button>
        </div>
      </div>
    </Box>
  );
}
