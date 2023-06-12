import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { triggerToast } from '@/utils/toast';
import { useRestoreApplicationDatabaseMutation } from '@/utils/__generated__/graphql';
import { format, parseISO } from 'date-fns';
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

export default function RestoreBackupModal({
  close,
  data,
}: RestoreBackupModalModalProps) {
  const { id: backupId, createdAt } = data;

  const [isSure, setIsSure] = useState(false);
  const [mutationIsCompleted, setMutationIsCompleted] = useState(false);
  const { currentProject } = useCurrentWorkspaceAndProject();

  const [restoreApplicationDatabase, { loading }] =
    useRestoreApplicationDatabaseMutation();

  const handleSubmit = async () => {
    setMutationIsCompleted(false);
    try {
      await restoreApplicationDatabase({
        variables: {
          backupId,
          appId: currentProject.id,
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
      <Box className="p-6">
        <div className="flex flex-col">
          <Text className="text-center text-lg font-medium">
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
    <Box className="grid grid-flow-row gap-2 px-6 pb-6">
      <Text>
        You current database will be deleted, and the backup created{' '}
        <span className="font-semibold">
          {format(parseISO(createdAt), 'yyyy-MM-dd HH:mm:ss')}
        </span>{' '}
        will be restored.
      </Text>

      <Box className="pt-1 pb-2.5">
        <Checkbox
          checked={isSure}
          onChange={(_event, checked) => setIsSure(checked)}
          label="I'm sure I want to restore this backup"
        />
      </Box>

      <Button onClick={handleSubmit} disabled={!isSure} loading={loading}>
        Restore
      </Button>

      <Button variant="outlined" color="secondary" onClick={close}>
        Cancel
      </Button>
    </Box>
  );
}
