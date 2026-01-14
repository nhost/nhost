import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useEstimatedDatabaseMigrationDowntime } from '@/features/orgs/projects/database/common/hooks/useEstimatedDatabaseMigrationDowntime';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetPostgresSettingsDocument,
  useUpdateDatabaseVersionMutation,
} from '@/utils/__generated__/graphql';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface DatabaseMigrateVersionConfirmationDialogProps {
  /**
   * New version to migrate to.
   */
  postgresVersion: string;
}

export default function DatabaseMigrateVersionConfirmationDialog({
  postgresVersion,
}: DatabaseMigrateVersionConfirmationDialogProps) {
  const isPlatform = useIsPlatform();
  const { openDialog, closeDialog } = useDialog();
  const localMimirClient = useLocalMimirClient();
  const [loading, setLoading] = useState(false);
  const { project } = useProject();
  const [updatePostgresMajor] = useUpdateDatabaseVersionMutation({
    refetchQueries: [GetPostgresSettingsDocument],
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
            appId: project?.id,
            version: postgresVersion,
          },
        });

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
