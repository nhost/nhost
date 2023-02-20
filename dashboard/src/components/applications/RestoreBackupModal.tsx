import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Checkbox from '@/ui/v2/Checkbox';
import Text from '@/ui/v2/Text';
import { triggerToast } from '@/utils/toast';
import { useRestoreApplicationDatabaseMutation } from '@/utils/__generated__/graphql';
import { formatISO9075 } from 'date-fns';
import { useState } from 'react';

export interface RestoreBackupModalModalProps {
  /**
   * Call this function to imperatively close the modal.
   */
  close: any;
  /**
   * Arbitrary data passed down to the modal.
   *
   */
  data: any;
}

export function RestoreBackupModal({
  close,
  data,
}: RestoreBackupModalModalProps) {
  const { id: backupId, createdAt } = data;

  const [isSure, setIsSure] = useState(false);
  const [mutationIsCompleted, setMutationIsCompleted] = useState(false);
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const [restoreApplicationDatabase, { loading }] =
    useRestoreApplicationDatabaseMutation();

  const handleSubmit = async () => {
    setMutationIsCompleted(false);
    try {
      await restoreApplicationDatabase({
        variables: {
          backupId,
          appId: currentApplication.id,
        },
      });
    } catch (error) {
      setMutationIsCompleted(false);
      triggerToast('Database backup restoration failed');
      return;
    }
    setMutationIsCompleted(true);
    triggerToast('Database backup successfully scheduled for restoration.');
  };

  if (mutationIsCompleted) {
    return (
      <Box className="w-modal p-6 rounded-lg">
        <div className="flex flex-col">
          <Text className="text-center font-medium text-lg">
            The backup has been restored successfully.
          </Text>

          <Button className="mt-5" onClick={close}>
            OK
          </Button>
        </div>
      </Box>
    );
  }

  return (
    <Box className="w-modal px-6 py-6 text-left rounded-lg">
      <div className="flex flex-col">
        <Text className="text-center text-lg font-medium">
          Restore Database Backup
        </Text>
        <Text className="mt-2 text-center font-normal">
          You current database will be deleted, and the backup created{' '}
          <span className="font-semibold">
            {formatISO9075(new Date(createdAt))}
          </span>{' '}
          will be restored.
        </Text>

        <Box className="my-4 border-y py-2 px-2">
          <Checkbox
            checked={isSure}
            onChange={(_event, checked) => setIsSure(checked)}
            label="I'm sure I want to restore this backup."
          />
        </Box>
        <Button onClick={handleSubmit} disabled={!isSure} loading={loading}>
          Restore
        </Button>
      </div>
    </Box>
  );
}
